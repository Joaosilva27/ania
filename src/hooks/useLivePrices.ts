import { useEffect, useMemo, useState } from 'react';
import type { SupermarketId } from '@/types';
import {
  EMPTY_RESULT,
  fetchLivePrices,
  type BasketLine,
  type LivePriceResult,
} from '@/services/pricing/live';

/** Ten minutes: shelf prices do not move between two screens in one session. */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: LivePriceResult }>();

export interface LivePricesState {
  result: LivePriceResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Live shelf prices for a basket, cached briefly per basket and shop list.
 * Prices are read from the shops each time the cache expires; nothing is stored
 * in the user's data.
 */
export function useLivePrices(
  lines: BasketLine[],
  stores: SupermarketId[],
  servings?: number,
): LivePricesState {
  const key = useMemo(
    () =>
      JSON.stringify({
        stores,
        servings: servings ?? null,
        lines: lines.map((line) => [
          line.ingredientId,
          Math.round(line.grams),
          line.count == null ? null : Math.round(line.count * 100) / 100,
        ]),
      }),
    [lines, stores, servings],
  );
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ result: LivePriceResult | null; loading: boolean; error: string | null }>({
    result: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!lines.length || !stores.length) {
      setState({ result: EMPTY_RESULT, loading: false, error: null });
      return;
    }
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS && attempt === 0) {
      setState({ result: cached.value, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ result: previous.result, loading: true, error: null }));
    fetchLivePrices(lines, stores, { servings, signal: controller.signal })
      .then((result) => {
        if (!active) return;
        cache.set(key, { at: Date.now(), value: result });
        setState({ result, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setState({
          result: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Could not reach the live price service',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `key` already encodes the basket and the shops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    result: state.result,
    loading: state.loading,
    error: state.error,
    refresh: () => {
      cache.delete(key);
      setAttempt((value) => value + 1);
    },
  };
}
