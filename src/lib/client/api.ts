"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ClientApiError extends Error {}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    throw new ClientApiError((data as { error?: string })?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export function postJson<T = unknown>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
}
export function patchJson<T = unknown>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });
}
export function deleteJson<T = unknown>(url: string, body?: unknown) {
  return apiFetch<T>(url, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined });
}

/**
 * Lightweight polling hook used in place of a persistent WebSocket
 * connection. Most managed Next.js hosting environments (including this
 * sandbox) do not expose a raw socket-upgrade path to App Router route
 * handlers, so realtime features (console, metrics, notifications) poll a
 * cheap JSON endpoint on a short interval behind this same abstraction.
 * Swapping to a real WebSocket/SSE transport later only requires changing
 * this hook — consuming components are unaffected.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setConnected(true);
      setError(null);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : "Connection lost");
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function loop() {
      if (!active) return;
      await refetch();
      if (active) timer = setTimeout(loop, intervalMs);
    }
    loop();

    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, error, connected, refetch };
}
