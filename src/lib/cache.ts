interface CacheEntry<T> {
  data     : T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60_000;

export const cache = {
  get<T>(key: string): T | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.data;
  },
  set<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },
  invalidate(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
  clear(): void { store.clear(); },
};

export async function cachedGet<T>(
  key    : string,
  fetcher: () => Promise<T>,
  ttlMs  = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== null) return hit;
  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}