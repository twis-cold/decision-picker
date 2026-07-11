/**
 * Persistence layer.
 *
 * The app only ever talks to loadState()/saveState(). Storage goes through a
 * tiny adapter interface — { read(), write(raw), clear() } — so swapping
 * localStorage for a backend API (accounts/auth/sync) later only means
 * providing a different adapter, not touching app code.
 */

const STORAGE_KEY = 'smart-decision-picker:v1';
export const SCHEMA_VERSION = 1;

export const localStorageAdapter = {
  read() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  },
  write(raw) {
    try { localStorage.setItem(STORAGE_KEY, raw); } catch { /* quota/private mode: keep running in-memory */ }
  },
  clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },
};

let adapter = localStorageAdapter;

/** Swap the storage backend (e.g. a remote API adapter once accounts exist). */
export function setAdapter(a) { adapter = a; }

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { plan: 'free' },
    activeCategoryId: null,
    /** @type {Array<{id, name, emoji, createdAt, options: Array<{id, label, banned, createdAt}>}>} */
    categories: [],
    /**
     * Newest-first log of every suggestion the app made.
     * Category/option names are snapshotted so history survives deletes.
     * @type {Array<{id, categoryId, categoryName, optionId, optionLabel, at, outcome}>}
     */
    history: [],
  };
}

/** Bring older/partial persisted states up to the current shape. */
function migrate(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    settings: { ...base.settings, ...(raw.settings || {}) },
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

export function loadState() {
  try {
    return migrate(JSON.parse(adapter.read()));
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  adapter.write(JSON.stringify(state));
}

export function resetState() {
  adapter.clear();
  return defaultState();
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
