import { useCallback, useEffect, useState } from "react";
import { clearPaperTrades, loadPaperTrades, savePaperTrade, type PaperTrade } from "../lib/paperTrading";

export function usePaperTrades() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    loadPaperTrades()
      .then((loaded) => {
        if (mounted) setTrades(loaded);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const addTrade = useCallback(async (trade: PaperTrade) => {
    await savePaperTrade(trade);
    setTrades((current) => [trade, ...current]);
  }, []);

  const resetTrades = useCallback(async () => {
    await clearPaperTrades();
    setTrades([]);
  }, []);

  return {
    addTrade,
    loading,
    resetTrades,
    trades,
  };
}
