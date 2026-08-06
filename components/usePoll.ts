"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetch `url` immediately and then every `intervalMs`, pausing while the
 * tab is hidden and refreshing as soon as it becomes visible again.
 * Previous data is kept on refresh errors so the UI degrades gracefully.
 */
export function usePoll<T>(url: string, intervalMs: number) {
  const [state, setState] = useState<PollState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const urlRef = useRef(url);

  const load = useCallback(async (target: string) => {
    try {
      const res = await fetch(target);
      const body = (await res.json().catch(() => null)) as
        | (T & { error?: string })
        | null;
      if (!res.ok || body == null) {
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      if (urlRef.current === target) {
        setState({ data: body, error: null, loading: false });
      }
    } catch (err) {
      if (urlRef.current === target) {
        setState((s) => ({
          data: s.data,
          error: err instanceof Error ? err.message : "Request failed",
          loading: false,
        }));
      }
    }
  }, []);

  useEffect(() => {
    urlRef.current = url;
    load(url);
    const tick = () => {
      if (document.visibilityState === "visible") load(url);
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, intervalMs, load]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    load(urlRef.current);
  }, [load]);

  return { ...state, reload };
}
