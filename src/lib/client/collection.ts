"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";

export type CollectionResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * Fetches an admin collection endpoint and exposes the loading/error/retry
 * state that every admin page needs. Re-fetches whenever the URL changes, so
 * search, filters and pagination stay declarative: each page just builds a
 * query string and renders the result.
 *
 * `TResponse` only has to expose `items` so endpoints that legitimately return
 * a whole (short) collection — e.g. hosting nodes — can add extra fields like
 * `agent` without pretending to be paginated.
 *
 * Stale responses are discarded (request sequence guard) so fast typing or
 * rapid page clicks can never render out-of-order data.
 */
export function useCollection<TItem, TResponse extends { items: TItem[] } = CollectionResponse<TItem>>(
  url: string,
) {
  const [data, setData] = useState<TResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    let active = true;

    // State updates live inside the async task rather than the effect body so
    // a new request never triggers a cascading render on mount.
    async function run() {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFetch<TResponse>(url);
        if (!active || currentRequest !== requestId.current) return;
        setData(result);
      } catch (err: unknown) {
        if (!active || currentRequest !== requestId.current) return;
        setData(null);
        setError(err instanceof Error ? err.message : "Unable to load data. Please try again.");
      } finally {
        if (active && currentRequest === requestId.current) setLoading(false);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [url, reloadKey]);

  return { data, error, loading, reload };
}

/** Debounces a rapidly changing value (e.g. a search box) before it hits the API. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
