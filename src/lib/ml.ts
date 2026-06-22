import { DEFAULT_ML_SETTINGS } from "./constants";
import { getRsi, mean, movingAverage, standardDeviation } from "./analytics";
import type { MlHorizon, MlSettings, StockCandle } from "../types";

type FeatureRecord = {
  date: string;
  features: number[];
  nextReturn: number;
};

type LogisticModel = {
  bias: number;
  means: number[];
  stds: number[];
  weights: number[];
};

type FeatureSignal = {
  contribution: number;
  detail: string;
  direction: "bearish" | "bullish";
  label: string;
  value: number;
  weight: number;
};

export type ForecastPoint = {
  expectedMove: number;
  horizon: MlHorizon;
  probabilityUp: number;
  sampleSize: number;
};

export type MlSignal = {
  confidence: number;
  expectedMove: number;
  features: FeatureSignal[];
  forecasts: ForecastPoint[];
  horizon: MlHorizon;
  probabilityHistory: Array<{
    date: string;
    nextReturn: number;
    probabilityUp: number;
  }>;
  probabilityUp: number;
  regime: string;
  sampleSize: number;
  settings: MlSettings;
  similarSetups: Array<{
    date: string;
    distance: number;
    nextReturn: number;
  }>;
  status: "limited" | "ready";
  testAccuracy: number;
  topDriver: string;
  trend: {
    components: Array<{
      label: string;
      score: number;
      value: string;
    }>;
    label: string;
    score: number;
  };
};

const FEATURE_LABELS = ["5D mom", "20D mom", "10D vol", "Volume z", "RSI", "Drawdown"];
const FEATURE_DETAILS = [
  "Close-to-close return over the last five trading sessions.",
  "Close-to-close return over the last twenty trading sessions.",
  "Realized standard deviation of the last ten daily close returns.",
  "Current volume versus the trailing twenty-session average, measured in standard deviations.",
  "Fourteen-session RSI normalized around zero; positive values mean stronger recent buying pressure.",
  "Distance from the trailing twenty-session high; deeper negative values mean price is further below recent highs.",
];
const FORECAST_HORIZONS: MlHorizon[] = [1, 5, 21, 63, 126, 252];

export function getMlSignals(candles: StockCandle[], settings: MlSettings = DEFAULT_ML_SETTINGS): MlSignal {
  const cleanSettings = normalizeSettings(settings);
  const records = buildRecords(candles, cleanSettings);
  const currentFeatures = buildFeatureVector(candles, candles.length - 1, cleanSettings);
  const trend = getTrendSignal(candles);

  if (records.length < 45 || !currentFeatures) {
    return getLimitedSignal(records.length, cleanSettings, trend);
  }

  const result = trainForHorizon(records, currentFeatures, cleanSettings);

  return {
    ...result,
    forecasts: FORECAST_HORIZONS.map((horizon) => getForecast(candles, { ...cleanSettings, horizon })),
    horizon: cleanSettings.horizon,
    settings: cleanSettings,
    trend,
  };
}

export function getHorizonLabel(horizon: MlHorizon) {
  if (horizon === 1) return "1D";
  if (horizon === 5) return "1W";
  if (horizon === 21) return "1M";
  if (horizon === 63) return "3M";
  if (horizon === 126) return "6M";
  return "1Y";
}

function trainForHorizon(records: FeatureRecord[], currentFeatures: number[], settings: MlSettings) {
  const finalModel = trainLogistic(records, settings);
  const currentVector = standardize(currentFeatures, finalModel);
  const probabilityUp = clamp(sigmoid(finalModel.bias + dot(finalModel.weights, currentVector)), 0.05, 0.95);
  const splitIndex = Math.max(24, Math.floor(records.length * 0.72));
  const trainRows = records.slice(0, splitIndex);
  const testRows = records.slice(splitIndex);
  const validationModel = trainRows.length >= 35 ? trainLogistic(trainRows, settings) : finalModel;
  const testAccuracy = testRows.length ? getAccuracy(testRows, validationModel) : 0;
  const similarSetups = getSimilarSetups(records, currentFeatures, finalModel);
  const expectedMove = similarSetups.length ? mean(similarSetups.map((setup) => setup.nextReturn)) : 0;
  const confidence = clamp((Math.abs(probabilityUp - 0.5) * 1.45 + Math.max(0, testAccuracy - 0.5)) / 1.05, 0, 1);
  const features = FEATURE_LABELS.map((label, index) => {
    const value = currentFeatures[index] ?? 0;
    const weight = finalModel.weights[index] ?? 0;
    const contribution = weight * (currentVector[index] ?? 0);
    const direction: "bearish" | "bullish" = contribution >= 0 ? "bullish" : "bearish";

    return {
      contribution,
      detail: FEATURE_DETAILS[index],
      direction,
      label,
      value,
      weight,
    };
  }).sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));
  const topFeature = features[0];

  return {
    confidence,
    expectedMove,
    features,
    probabilityHistory: records.map((record) => ({
      date: record.date,
      nextReturn: record.nextReturn,
      probabilityUp: clamp(sigmoid(finalModel.bias + dot(finalModel.weights, standardize(record.features, finalModel))), 0.05, 0.95),
    })),
    probabilityUp,
    regime: getRegime(probabilityUp, currentFeatures[2] ?? 0, expectedMove),
    sampleSize: records.length,
    similarSetups,
    status: "ready" as const,
    testAccuracy,
    topDriver: topFeature ? `${topFeature.label} ${topFeature.direction}` : "No dominant driver",
  };
}

function getForecast(candles: StockCandle[], settings: MlSettings): ForecastPoint {
  const records = buildRecords(candles, settings);
  const currentFeatures = buildFeatureVector(candles, candles.length - 1, settings);

  if (records.length < 45 || !currentFeatures) {
    return {
      expectedMove: 0,
      horizon: settings.horizon,
      probabilityUp: 0.5,
      sampleSize: records.length,
    };
  }

  const model = trainLogistic(records, settings);
  const probabilityUp = clamp(sigmoid(model.bias + dot(model.weights, standardize(currentFeatures, model))), 0.05, 0.95);
  const similarSetups = getSimilarSetups(records, currentFeatures, model);

  return {
    expectedMove: similarSetups.length ? mean(similarSetups.map((setup) => setup.nextReturn)) : 0,
    horizon: settings.horizon,
    probabilityUp,
    sampleSize: records.length,
  };
}

function buildRecords(candles: StockCandle[], settings: MlSettings): FeatureRecord[] {
  const usable = candles.slice(-settings.trainingWindow);

  return usable
    .slice(30, -settings.horizon)
    .map((_, offset) => {
      const index = offset + 30;
      const features = buildFeatureVector(usable, index, settings);
      const close = usable[index].close;
      const futureClose = usable[index + settings.horizon]?.close;

      if (!features || !close || !futureClose) return null;

      return {
        date: usable[index].date,
        features,
        nextReturn: futureClose / close - 1,
      };
    })
    .filter((record): record is FeatureRecord => Boolean(record));
}

function buildFeatureVector(candles: StockCandle[], index: number, settings: MlSettings) {
  if (index < 30 || index >= candles.length) return null;

  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const close = closes[index];
  const returns = closes.slice(1, index + 1).map((value, offset) => (closes[offset] ? value / closes[offset] - 1 : 0));
  const volumeWindow = volumes.slice(index - 19, index + 1);
  const volumeStd = standardDeviation(volumeWindow);
  const high20 = Math.max(...closes.slice(index - 19, index + 1));

  if (!close || !closes[index - 5] || !closes[index - 20] || !high20) return null;

  const features = [
    close / closes[index - 5] - 1,
    close / closes[index - 20] - 1,
    standardDeviation(returns.slice(-10)),
    settings.includeVolume && volumeStd ? ((volumes[index] ?? 0) - mean(volumeWindow)) / volumeStd : 0,
    (getRsi(closes.slice(0, index + 1), 14) - 50) / 50,
    close / high20 - 1,
  ];

  return applyModelStyle(features, settings);
}

function trainLogistic(records: FeatureRecord[], settings: MlSettings): LogisticModel {
  const featureCount = FEATURE_LABELS.length;
  const means = Array.from({ length: featureCount }, (_, index) => mean(records.map((record) => record.features[index] ?? 0)));
  const stds = Array.from({ length: featureCount }, (_, index) => standardDeviation(records.map((record) => record.features[index] ?? 0)) || 1);
  const baseRate = records.filter((record) => record.nextReturn > 0).length / records.length;
  const model: LogisticModel = {
    bias: Math.log(clamp(baseRate, 0.05, 0.95) / (1 - clamp(baseRate, 0.05, 0.95))),
    means,
    stds,
    weights: getInitialWeights(settings),
  };
  const learningRate = 0.075;
  const l2 = settings.modelStyle === "balanced" ? 0.018 : 0.026;

  for (let epoch = 0; epoch < 360; epoch += 1) {
    let biasGradient = 0;
    const gradients = Array.from({ length: featureCount }, () => 0);

    records.forEach((record) => {
      const features = standardize(record.features, model);
      const target = record.nextReturn > 0 ? 1 : 0;
      const prediction = sigmoid(model.bias + dot(model.weights, features));
      const error = prediction - target;

      biasGradient += error;
      features.forEach((value, index) => {
        gradients[index] += error * value + l2 * model.weights[index];
      });
    });

    model.bias -= (learningRate * biasGradient) / records.length;
    model.weights = model.weights.map((weight, index) => weight - (learningRate * gradients[index]) / records.length);
  }

  return model;
}

function getTrendSignal(candles: StockCandle[]) {
  const closes = candles.map((candle) => candle.close);
  const latest = closes[closes.length - 1] ?? 0;
  const sma20 = movingAverage(closes, 20);
  const sma50 = movingAverage(closes, 50);
  const sma200 = movingAverage(closes, 200);
  const momentum20 = sma20 ? latest / sma20 - 1 : 0;
  const momentum50 = sma50 ? latest / sma50 - 1 : 0;
  const trendStack = latest >= sma20 && sma20 >= sma50 && sma50 >= sma200 ? 1 : latest <= sma20 && sma20 <= sma50 && sma50 <= sma200 ? -1 : 0;
  const rsiScore = (getRsi(closes, 14) - 50) / 50;
  const high252 = Math.max(...closes.slice(-252), latest);
  const drawdown = high252 ? latest / high252 - 1 : 0;
  const components = [
    { label: "Stack", score: trendStack, value: trendStack > 0 ? "Aligned up" : trendStack < 0 ? "Aligned down" : "Mixed" },
    { label: "20D trend", score: clamp(momentum20 * 12, -1, 1), value: `${(momentum20 * 100).toFixed(2)}%` },
    { label: "50D trend", score: clamp(momentum50 * 8, -1, 1), value: `${(momentum50 * 100).toFixed(2)}%` },
    { label: "RSI", score: clamp(rsiScore, -1, 1), value: getRsi(closes, 14).toFixed(1) },
    { label: "Drawdown", score: clamp(1 + drawdown * 4, -1, 1), value: `${(drawdown * 100).toFixed(2)}%` },
  ];
  const score = clamp(mean(components.map((component) => component.score)), -1, 1);

  return {
    components,
    label: getTrendLabel(score),
    score,
  };
}

function getTrendLabel(score: number) {
  if (score >= 0.55) return "Strong bullish";
  if (score >= 0.2) return "Bullish";
  if (score <= -0.55) return "Strong bearish";
  if (score <= -0.2) return "Bearish";
  return "Mixed";
}

function getAccuracy(records: FeatureRecord[], model: LogisticModel) {
  const correct = records.filter((record) => {
    const probability = sigmoid(model.bias + dot(model.weights, standardize(record.features, model)));
    return (probability >= 0.5) === record.nextReturn > 0;
  }).length;

  return correct / records.length;
}

function getSimilarSetups(records: FeatureRecord[], currentFeatures: number[], model: LogisticModel) {
  const current = standardize(currentFeatures, model);

  return records
    .map((record) => {
      const features = standardize(record.features, model);
      const distance = Math.sqrt(features.reduce((sum, value, index) => sum + (value - current[index]) ** 2, 0));
      return {
        date: record.date,
        distance,
        nextReturn: record.nextReturn,
      };
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 9);
}

function getRegime(probabilityUp: number, realizedVol: number, expectedMove: number) {
  if (realizedVol > 0.035) return probabilityUp >= 0.52 ? "High-vol bull" : "High-vol risk";
  if (probabilityUp >= 0.6 && expectedMove >= 0) return "Momentum bull";
  if (probabilityUp <= 0.4 && expectedMove <= 0) return "Bear pressure";
  if (Math.abs(expectedMove) < 0.002) return "Range-bound";
  return expectedMove >= 0 ? "Constructive" : "Cautious";
}

function getLimitedSignal(sampleSize: number, settings: MlSettings, trend = getTrendSignal([])): MlSignal {
  return {
    confidence: 0,
    expectedMove: 0,
    features: [],
    forecasts: FORECAST_HORIZONS.map((horizon) => ({ expectedMove: 0, horizon, probabilityUp: 0.5, sampleSize: 0 })),
    horizon: settings.horizon,
    probabilityHistory: [],
    probabilityUp: 0.5,
    regime: "Needs history",
    sampleSize,
    settings,
    similarSetups: [],
    status: "limited",
    testAccuracy: 0,
    topDriver: "More candles needed",
    trend,
  };
}

function normalizeSettings(settings: MlSettings): MlSettings {
  const fallback = DEFAULT_ML_SETTINGS;
  return {
    horizon: FORECAST_HORIZONS.includes(settings.horizon) ? settings.horizon : fallback.horizon,
    includeVolume: Boolean(settings.includeVolume),
    modelStyle: ["balanced", "momentum", "meanReversion"].includes(settings.modelStyle) ? settings.modelStyle : fallback.modelStyle,
    trainingWindow: [252, 504, 756, 1260].includes(settings.trainingWindow) ? settings.trainingWindow : fallback.trainingWindow,
  };
}

function applyModelStyle(features: number[], settings: MlSettings) {
  if (settings.modelStyle === "momentum") {
    return features.map((value, index) => (index <= 1 ? value * 1.25 : index === 5 ? value * 0.75 : value));
  }

  if (settings.modelStyle === "meanReversion") {
    return features.map((value, index) => (index <= 1 || index === 4 ? value * -0.9 : value));
  }

  return features;
}

function getInitialWeights(settings: MlSettings) {
  if (settings.modelStyle === "momentum") return [0.08, 0.12, -0.04, 0, 0.04, 0.02];
  if (settings.modelStyle === "meanReversion") return [-0.08, -0.1, -0.02, 0, -0.05, 0.06];
  return [0, 0, 0, 0, 0, 0];
}

function standardize(features: number[], model: LogisticModel) {
  return features.map((value, index) => (value - model.means[index]) / model.stds[index]);
}

function dot(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
