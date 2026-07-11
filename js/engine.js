/**
 * Weighting engine — pure functions, no DOM, no storage.
 *
 * Every option starts equal. Feedback shifts the odds:
 *   loved  ×1.35 each   (suggested more)
 *   fine   ×1.05 each   (mild positive — it was accepted)
 *   skip   ×0.55 each   (suggested less)
 *   never  → weight 0   (banned until un-banned)
 * Options that were suggested recently are deprioritized so the picker
 * doesn't repeat itself, and never-tried options get a small exploration
 * bonus so new entries get a fair shot.
 */

export const OUTCOMES = Object.freeze({
  PENDING: 'pending',
  LOVED: 'loved',
  FINE: 'fine',
  SKIPPED: 'skipped',
  NEVER: 'never',
});

const LOVE_MULT = 1.35;
const FINE_MULT = 1.05;
const SKIP_MULT = 0.55;
const EXPLORATION_BONUS = 1.25;
const AFFINITY_MIN = 0.05;
const AFFINITY_MAX = 6;

/** Penalty by "how many suggestions ago this option last came up" (0 = the very last one). */
const RECENCY_PENALTY = [0.12, 0.35, 0.65];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Tally an option's outcomes from history entries.
 * @param {string} optionId
 * @param {Array<{optionId:string, outcome:string}>} entries newest-first history for one category
 */
export function deriveStats(optionId, entries) {
  const s = { loves: 0, fines: 0, skips: 0, picks: 0, suggestions: 0 };
  for (const e of entries) {
    if (e.optionId !== optionId) continue;
    s.suggestions++;
    switch (e.outcome) {
      case OUTCOMES.LOVED: s.loves++; s.picks++; break;
      case OUTCOMES.FINE: s.fines++; s.picks++; break;
      case OUTCOMES.PENDING: s.picks++; break;
      case OUTCOMES.SKIPPED: s.skips++; break;
    }
  }
  return s;
}

/**
 * Compute the selection weight for an option.
 * @param {{id:string, banned?:boolean}} option
 * @param {Array<{optionId:string, outcome:string}>} entries newest-first history for the option's category
 */
export function weightFor(option, entries) {
  if (option.banned) return 0;

  const s = deriveStats(option.id, entries);
  let affinity =
    Math.pow(LOVE_MULT, s.loves) *
    Math.pow(FINE_MULT, s.fines) *
    Math.pow(SKIP_MULT, s.skips);
  if (s.suggestions === 0) affinity *= EXPLORATION_BONUS;
  affinity = clamp(affinity, AFFINITY_MIN, AFFINITY_MAX);

  const lastIdx = entries.findIndex((e) => e.optionId === option.id);
  const recency = lastIdx === -1 ? 1 : (RECENCY_PENALTY[lastIdx] ?? 1);

  return affinity * recency;
}

/**
 * Weighted random pick. Items with weight 0 can never win.
 * @template T
 * @param {T[]} items
 * @param {(item:T) => number} weightOf
 * @param {() => number} rng
 * @returns {T|null}
 */
export function weightedPick(items, weightOf, rng = Math.random) {
  const weights = items.map((it) => Math.max(0, weightOf(it)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  // floating point spill-over: return the last item with a positive weight
  for (let i = items.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return items[i];
  }
  return null;
}

/**
 * Convenience: normalized share (0..1) of each option's weight, for UI odds bars.
 * @returns {Map<string, number>} optionId -> share
 */
export function oddsShare(options, entries) {
  const weights = options.map((o) => weightFor(o, entries));
  const total = weights.reduce((a, b) => a + b, 0);
  const map = new Map();
  options.forEach((o, i) => map.set(o.id, total > 0 ? weights[i] / total : 0));
  return map;
}
