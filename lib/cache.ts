/**
 * In-memory TTL cache with in-flight request deduplication and
 * stale-on-error fallback. Keeps us well inside free-tier API rate
 * limits even with the dashboard polling every 60 seconds.
 *
 * Note: on serverless (Vercel), each warm lambda instance keeps its own
 * cache — good enough for a personal project.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
  inFlight: Promise<unknown> | null;
}

const store = new Map<string, Entry>();

const MAX_ENTRIES = 500;

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && entry.value !== undefined && entry.expiresAt > now) {
    return entry.value as T;
  }
  if (entry?.inFlight) {
    return entry.inFlight as Promise<T>;
  }

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs, inFlight: null });
      return value;
    })
    .catch((err) => {
      const stale = store.get(key);
      if (stale) stale.inFlight = null;
      // Serve stale data rather than failing when the upstream API
      // errors or rate-limits us.
      if (stale && stale.value !== undefined) return stale.value as T;
      throw err;
    });

  if (store.size > MAX_ENTRIES) evictExpired();
  store.set(key, {
    value: entry?.value,
    expiresAt: entry?.expiresAt ?? 0,
    inFlight: promise,
  });

  return promise;
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now && !entry.inFlight) store.delete(key);
  }
}
