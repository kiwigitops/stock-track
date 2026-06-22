import { getRsi, mean, standardDeviation } from "./analytics";
import type { StockCandle } from "../types";

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

export type MlSignal = {
  confidence: number;
  expectedMove: number;
  features: Array<{
    contribution: number;
    direction: "bearish" | "bullish";
    label: string;
    value: number;
    weight: number;
  }>;
  probabilityHistory: Array<{
    date: string;
    nextReturn: number;
    probabilityUp: number;
  }>;
  probabilityUp: number;
  regime: string;
  sampleSize: number;
  similarSetups: Array<{
    date: string;
    distance: number;
    nextReturn: number;
  }>;
  status: "limited" | "ready";
  testAccuracy: number;
  topDriver: string;
};

const FEATURE_LABELS = ["5D mom", "20D mom", "10D vol", "Volume z", "RSI", "Drawdown"];

export function getMlSignals(candles: StockCandle[]): MlSignal {
  const records = buildRecords(candles);
  const currentFeatures = buildFeatureVector(candles, candles.length - 1);

  if (records.length < 45 || !currentFeatures) {
    return getLimitedSignal(records.length);
  }

  const finalModel = trainLogistic(records);
  const currentVector = standardize(currentFeatures, finalModel);
  const probabilityUp = clamp(sigmoid(finalModel.bias + dot(finalModel.weights, currentVector)), 0.05, 0.95);
  const splitIndex = Math.max(24, Math.floor(records.length * 0.72));
  const trainRows = records.slice(0, splitIndex);
  const testRows = records.slice(splitIndex);
  const validationModel = trainRows.length >= 35 ? trainLogistic(trainRows) : finalModel;
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
    probabilityHistory: records.slice(-120).map((record) => ({
      date: record.date,
      nextReturn: record.nextReturn,
      probabilityUp: clamp(sigmoid(finalModel.bias + dot(finalModel.weights, standardize(record.features, finalModel))), 0.05, 0.95),
    })),
    probabilityUp,
    regime: getRegime(probabilityUp, currentFeatures[2] ?? 0, expectedMove),
    sampleSize: records.length,
    similarSetups,
    status: "ready",
    testAccuracy,
    topDriver: topFeature ? `${topFeature.label} ${topFeature.direction}` : "No dominant driver",
  };
}

function buildRecords(candles: StockCandle[]): FeatureRecord[] {
  return candles
    .slice(30, -1)
    .map((_, offset) => {
      const index = offset + 30;
      const features = buildFeatureVector(candles, index);
      const close = candles[index].close;
      const nextClose = candles[index + 1].close;

      if (!features || !close || !nextClose) return null;

      return {
        date: candles[index].date,
        features,
        nextReturn: nextClose / close - 1,
      };
    })
    .filter((record): record is FeatureRecord => Boolean(record));
}

function buildFeatureVector(candles: StockCandle[], index: number) {
  if (index < 30 || index >= candles.length) return null;

  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const close = closes[index];
  const returns = closes.slice(1, index + 1).map((value, offset) => (closes[offset] ? value / closes[offset] - 1 : 0));
  const volumeWindow = volumes.slice(index - 19, index + 1);
  const volumeStd = standardDeviation(volumeWindow);
  const high20 = Math.max(...closes.slice(index - 19, index + 1));

  if (!close || !closes[index - 5] || !closes[index - 20] || !high20) return null;

  return [
    close / closes[index - 5] - 1,
    close / closes[index - 20] - 1,
    standardDeviation(returns.slice(-10)),
    volumeStd ? ((volumes[index] ?? 0) - mean(volumeWindow)) / volumeStd : 0,
    (getRsi(closes.slice(0, index + 1), 14) - 50) / 50,
    close / high20 - 1,
  ];
}

function trainLogistic(records: FeatureRecord[]): LogisticModel {
  const featureCount = FEATURE_LABELS.length;
  const means = Array.from({ length: featureCount }, (_, index) => mean(records.map((record) => record.features[index] ?? 0)));
  const stds = Array.from({ length: featureCount }, (_, index) => standardDeviation(records.map((record) => record.features[index] ?? 0)) || 1);
  const baseRate = records.filter((record) => record.nextReturn > 0).length / records.length;
  const model: LogisticModel = {
    bias: Math.log(clamp(baseRate, 0.05, 0.95) / (1 - clamp(baseRate, 0.05, 0.95))),
    means,
    stds,
    weights: Array.from({ length: featureCount }, () => 0),
  };
  const learningRate = 0.075;
  const l2 = 0.018;

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

function getLimitedSignal(sampleSize: number): MlSignal {
  return {
    confidence: 0,
    expectedMove: 0,
    features: [],
    probabilityHistory: [],
    probabilityUp: 0.5,
    regime: "Needs history",
    sampleSize,
    similarSetups: [],
    status: "limited",
    testAccuracy: 0,
    topDriver: "More candles needed",
  };
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
