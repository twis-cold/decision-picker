/**
 * Plan gating. All free-vs-pro rules live here so wiring up real payments
 * later only means changing how `settings.plan` gets set (e.g. from a
 * billing webhook / license check) — feature checks stay the same.
 */

export const PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    label: 'Free',
    maxCategories: 3,
    canExport: false,
    canSurprise: false,
  }),
  pro: Object.freeze({
    id: 'pro',
    label: 'Pro',
    maxCategories: Infinity,
    canExport: true,
    canSurprise: true,
  }),
});

export function getPlan(state) {
  return PLANS[state.settings?.plan] ?? PLANS.free;
}

export function isPro(state) {
  return getPlan(state).id === 'pro';
}

export function canAddCategory(state) {
  return state.categories.length < getPlan(state).maxCategories;
}
