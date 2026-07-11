/**
 * UI layer — rendering + event wiring. All logic lives in engine.js,
 * persistence in store.js, plan rules in entitlements.js.
 */

import { loadState, saveState, resetState, uid } from './store.js';
import { OUTCOMES, weightFor, weightedPick, oddsShare } from './engine.js';
import { getPlan, isPro, canAddCategory, PLANS } from './entitlements.js';

let state = loadState();

/** Ephemeral per-round UI state (never persisted). */
const round = {
  excludedIds: new Set(), // options skipped this round — don't re-offer immediately
  pendingEntryId: null,   // history entry awaiting feedback
  revealing: false,
  shuffleTimer: null,
};

let historyFilter = 'category'; // 'category' | 'all'
let modalEmoji = '';

const $ = (sel) => document.querySelector(sel);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STARTER_TEMPLATES = [
  { emoji: '🍝', name: 'Dinner Ideas', options: ['Tacos', 'Stir fry', 'Pasta night', 'Homemade pizza', 'Curry', 'Big salad', 'Burgers', 'Sushi takeout'] },
  { emoji: '💪', name: 'Workout Type', options: ['Upper body', 'Leg day', 'Long run', 'Yoga', 'HIIT', 'Swim', 'Rest + stretch'] },
  { emoji: '🌃', name: 'Date Night', options: ['New restaurant', 'Movie night', 'Cook together', 'Mini golf', 'Live music', 'Picnic', 'Museum wander'] },
  { emoji: '🎬', name: 'Movie Genre', options: ['Thriller', 'Comedy', 'Sci-fi', 'Documentary', 'Horror', 'Classic rewatch', 'Animation'] },
];

const CATEGORY_EMOJIS = ['✨', '🍝', '💪', '🌃', '🎬', '📚', '🎮', '✈️', '☕', '🎧', '🧘', '🛠️'];

const OUTCOME_META = {
  [OUTCOMES.LOVED]: { chip: 'loved', label: 'Loved it' },
  [OUTCOMES.FINE]: { chip: 'fine', label: 'Fine' },
  [OUTCOMES.SKIPPED]: { chip: 'skipped', label: 'Skipped' },
  [OUTCOMES.NEVER]: { chip: 'never', label: 'Never again' },
  [OUTCOMES.PENDING]: { chip: 'pending', label: 'No rating' },
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function relTime(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function commit() { saveState(state); }

function activeCategory() {
  return state.categories.find((c) => c.id === state.activeCategoryId) ?? null;
}

function categoryHistory(categoryId) {
  return state.history.filter((h) => h.categoryId === categoryId);
}

function toast(msg) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 350);
  }, 2400);
}

/* ------------------------------------------------------------------ */
/* mutations                                                           */
/* ------------------------------------------------------------------ */

function createCategory(name, emoji, options = []) {
  if (!canAddCategory(state)) { openUpgradeModal('More than 3 categories is a Pro feature.'); return null; }
  const cat = {
    id: uid(),
    name: name.trim(),
    emoji: emoji || '✨',
    createdAt: Date.now(),
    options: options.map((label) => ({ id: uid(), label, banned: false, createdAt: Date.now() })),
  };
  state.categories.push(cat);
  state.activeCategoryId = cat.id;
  resetRound();
  commit();
  return cat;
}

function addOptions(cat, rawText) {
  const existing = new Set(cat.options.map((o) => o.label.toLowerCase()));
  const labels = rawText
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !existing.has(s.toLowerCase()) && (existing.add(s.toLowerCase()), true));
  for (const label of labels) {
    cat.options.push({ id: uid(), label, banned: false, createdAt: Date.now() });
  }
  commit();
  return labels.length;
}

function recordDecision(cat, option) {
  const entry = {
    id: uid(),
    categoryId: cat.id,
    categoryName: cat.name,
    optionId: option.id,
    optionLabel: option.label,
    at: Date.now(),
    outcome: OUTCOMES.PENDING,
  };
  state.history.unshift(entry);
  if (state.history.length > 500) state.history.length = 500; // keep the log lightweight
  round.pendingEntryId = entry.id;
  commit();
  return entry;
}

function setOutcome(entryId, outcome) {
  const entry = state.history.find((h) => h.id === entryId);
  if (!entry) return null;
  entry.outcome = outcome;
  if (outcome === OUTCOMES.NEVER) {
    const cat = state.categories.find((c) => c.id === entry.categoryId);
    const opt = cat?.options.find((o) => o.id === entry.optionId);
    if (opt) opt.banned = true;
  }
  commit();
  return entry;
}

function resetRound() {
  round.excludedIds.clear();
  round.pendingEntryId = null;
  round.revealing = false;
  if (round.shuffleTimer) { clearInterval(round.shuffleTimer); round.shuffleTimer = null; }
}

/* ------------------------------------------------------------------ */
/* the decide flow                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pick a suggestion. `surprise` draws across every category (Pro).
 * Skipped options in the current round are excluded so "Skip" always
 * moves on to something else; exclusions reset once everything was seen.
 */
function decide({ surprise = false } = {}) {
  if (round.revealing) return;

  if (surprise && !getPlan(state).canSurprise) {
    openUpgradeModal('"Surprise me" across all categories is a Pro feature.');
    return;
  }

  // build candidate pool: [{ option, cat }]
  let pool = [];
  if (surprise) {
    for (const cat of state.categories) {
      pool.push(...cat.options.map((option) => ({ option, cat })));
    }
  } else {
    const cat = activeCategory();
    if (!cat) return;
    pool = cat.options.map((option) => ({ option, cat }));
  }

  let usable = pool.filter(({ option }) => !option.banned);
  if (usable.length === 0) {
    toast(pool.length ? 'Every option is on the "never" list — un-ban some below.' : 'Add a few options first.');
    return;
  }

  let candidates = usable.filter(({ option }) => !round.excludedIds.has(option.id));
  if (candidates.length === 0) {
    round.excludedIds.clear(); // skipped everything — start over
    candidates = usable;
  }

  const winner = weightedPick(
    candidates,
    ({ option, cat }) => weightFor(option, categoryHistory(cat.id)),
  );
  if (!winner) { toast('Nothing left to suggest right now.'); return; }

  const labels = candidates.map(({ option }) => option.label);
  runReveal(winner, labels, surprise);
}

/** Shuffle-then-settle animation before committing the decision. */
function runReveal(winner, labels, surprise) {
  round.revealing = true;
  renderHero(); // shows the shuffling stage

  const textEl = $('#result-text');
  const finish = () => {
    if (round.shuffleTimer) { clearInterval(round.shuffleTimer); round.shuffleTimer = null; }
    round.revealing = false;
    recordDecision(winner.cat, winner.option);
    render();
    $('#stage-glow')?.classList.add('on');
  };

  if (reduceMotion || labels.length < 2) { finish(); return; }

  let ticks = 0;
  const total = 11;
  round.shuffleTimer = setInterval(() => {
    ticks++;
    if (textEl) textEl.textContent = labels[Math.floor(Math.random() * labels.length)];
    if (ticks >= total) finish();
  }, 75);
}

function handleFeedback(outcome) {
  const entry = setOutcome(round.pendingEntryId, outcome);
  if (!entry) return;

  if (outcome === OUTCOMES.SKIPPED || outcome === OUTCOMES.NEVER) {
    round.excludedIds.add(entry.optionId);
    round.pendingEntryId = null;
    if (outcome === OUTCOMES.NEVER) toast(`"${entry.optionLabel}" won't be suggested again.`);
    // roll again right away — a skip means "give me something else"
    decide({ surprise: entry.categoryId !== state.activeCategoryId });
  } else {
    round.pendingEntryId = null;
    round.excludedIds.clear();
    toast(outcome === OUTCOMES.LOVED ? 'Noted — more like this. 💜' : 'Got it.');
    render();
  }
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */

function render() {
  renderPlanBadge();
  renderCatbar();
  renderHero();
  renderOptionsPanel();
  renderHistoryPanel();
}

function renderPlanBadge() {
  const badge = $('#plan-badge');
  const pro = isPro(state);
  badge.textContent = pro ? 'PRO' : 'FREE';
  badge.classList.toggle('pro', pro);
}

function renderCatbar() {
  const bar = $('#catbar');
  const atLimit = !canAddCategory(state);
  bar.innerHTML = state.categories.map((c) => `
    <button class="cat-pill ${c.id === state.activeCategoryId ? 'active' : ''}" data-action="select-category" data-id="${c.id}">
      <span>${esc(c.emoji)} ${esc(c.name)}</span>
      <span class="cnt">${c.options.filter((o) => !o.banned).length}</span>
    </button>
  `).join('') + `
    <button class="cat-pill add" data-action="open-add-category">
      + New category${atLimit ? '<span class="lock-tag">PRO</span>' : ''}
    </button>
  `;
}

function renderHero() {
  const hero = $('#hero');
  const cat = activeCategory();

  // --- no categories yet: onboarding ---
  if (!cat) {
    hero.innerHTML = `
      <div class="hero-stage">
        <p class="result-label">Welcome</p>
        <h1 class="result-text revealed">Stop overthinking the small stuff.</h1>
        <p class="hero-hint">Create a category, toss in your options, and let the picker decide.
        It learns what you love — and quietly retires what you skip.</p>
        <div class="tpl-grid">
          ${STARTER_TEMPLATES.map((t, i) => `
            <button class="tpl-chip" data-action="use-template" data-idx="${i}">${t.emoji} ${esc(t.name)}</button>
          `).join('')}
        </div>
        <button class="btn btn-ghost" data-action="open-add-category">Or start from scratch →</button>
      </div>
    `;
    return;
  }

  const usable = cat.options.filter((o) => !o.banned);
  const pendingEntry = state.history.find((h) => h.id === round.pendingEntryId);
  const plan = getPlan(state);
  const surpriseBtn = state.categories.length > 1 ? `
    <button class="btn btn-ghost" data-action="surprise">
      🎲 Surprise me — all categories${plan.canSurprise ? '' : '<span class="lock-tag">PRO</span>'}
    </button>` : '';

  const head = `
    <div class="hero-head">
      <h1 class="hero-title">${esc(cat.emoji)} ${esc(cat.name)}</h1>
      <span class="hero-sub">${usable.length} option${usable.length === 1 ? '' : 's'} in play</span>
    </div>
  `;

  // --- shuffling ---
  if (round.revealing) {
    hero.innerHTML = `${head}
      <div class="hero-stage">
        <div class="stage-glow" id="stage-glow"></div>
        <p class="result-label">Deciding…</p>
        <h2 class="result-text shuffling" id="result-text">…</h2>
      </div>
    `;
    return;
  }

  // --- a suggestion is on the table ---
  if (pendingEntry) {
    const isCross = pendingEntry.categoryId !== cat.id;
    hero.innerHTML = `${head}
      <div class="hero-stage">
        <div class="stage-glow" id="stage-glow"></div>
        <p class="result-label">Your pick</p>
        <h2 class="result-text revealed" id="result-text">${esc(pendingEntry.optionLabel)}</h2>
        ${isCross ? `<span class="result-cat-tag">from ${esc(pendingEntry.categoryName)}</span>` : ''}
        <div class="feedback-row">
          <button class="fb-btn" data-action="feedback" data-outcome="loved"><span class="em">😍</span> Loved it</button>
          <button class="fb-btn" data-action="feedback" data-outcome="fine"><span class="em">👍</span> Fine</button>
          <button class="fb-btn" data-action="feedback" data-outcome="skipped"><span class="em">⏭️</span> Skip</button>
          <button class="fb-btn" data-action="feedback" data-outcome="never"><span class="em">🚫</span> Never again</button>
        </div>
        <div class="hero-secondary">
          <button class="btn btn-ghost" data-action="decide">↻ Decide again</button>
        </div>
      </div>
    `;
    return;
  }

  // --- idle: the big moment ---
  hero.innerHTML = `${head}
    <div class="hero-stage">
      <div class="stage-glow" id="stage-glow"></div>
      ${usable.length === 0
        ? `<p class="hero-hint">No options yet — add a few in the <strong>Options</strong> panel and come back for the magic.</p>`
        : `
          <p class="hero-hint">One tap. Zero deliberation. The picker weighs what you've loved,
          skipped, and picked lately.</p>
          <button class="btn btn-decide" data-action="decide">Decide for me</button>
          <div class="hero-secondary">${surpriseBtn}</div>
        `}
    </div>
  `;
}

function renderOptionsPanel() {
  const panel = $('#options-panel');
  const cat = activeCategory();
  if (!cat) { panel.innerHTML = `<div class="empty-note">Pick or create a category to manage its options.</div>`; return; }

  const entries = categoryHistory(cat.id);
  const odds = oddsShare(cat.options, entries);
  const maxShare = Math.max(0.001, ...odds.values());

  const rows = cat.options.map((o) => {
    const share = odds.get(o.id) ?? 0;
    const stats = statLine(o.id, entries);
    return `
      <div class="opt-row ${o.banned ? 'banned' : ''}">
        <div class="opt-main">
          <div class="opt-name" title="${esc(o.label)}">${esc(o.label)}</div>
          <div class="opt-meta">
            ${o.banned
              ? `<span class="opt-stats">never suggested</span>`
              : `<div class="odds" title="Current chance: ${(share * 100).toFixed(0)}%"><i style="width:${Math.round((share / maxShare) * 100)}%"></i></div>
                 <span class="opt-stats">${stats}</span>`}
          </div>
        </div>
        <div class="opt-actions">
          <button class="mini-btn" data-action="toggle-ban" data-id="${o.id}" title="${o.banned ? 'Allow again' : 'Never suggest'}">${o.banned ? '↩︎' : '🚫'}</button>
          <button class="mini-btn danger" data-action="delete-option" data-id="${o.id}" title="Delete">✕</button>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="panel-head">
      <h3 class="panel-title">Options <span class="cnt">${cat.options.length}</span></h3>
      <div class="panel-actions">
        <button class="mini-btn danger" data-action="delete-category">Delete category</button>
      </div>
    </div>
    <form class="add-form" data-form="add-option">
      <input type="text" name="label" placeholder="Add an option…" autocomplete="off" required>
      <button class="btn btn-ghost" type="submit">Add</button>
    </form>
    <p class="form-hint">Tip: separate with commas to add several at once.</p>
    <div class="opt-list">
      ${rows || `<div class="empty-note">Nothing here yet — add your first option above.</div>`}
    </div>
  `;
}

function statLine(optionId, entries) {
  let loved = 0, fine = 0, skipped = 0;
  for (const e of entries) {
    if (e.optionId !== optionId) continue;
    if (e.outcome === OUTCOMES.LOVED) loved++;
    else if (e.outcome === OUTCOMES.FINE) fine++;
    else if (e.outcome === OUTCOMES.SKIPPED) skipped++;
  }
  if (!loved && !fine && !skipped) return 'new';
  return [loved && `😍${loved}`, fine && `👍${fine}`, skipped && `⏭${skipped}`].filter(Boolean).join(' ');
}

function renderHistoryPanel() {
  const panel = $('#history-panel');
  const cat = activeCategory();
  const showAll = historyFilter === 'all' || !cat;
  const entries = (showAll ? state.history : categoryHistory(cat.id)).slice(0, 50);
  const plan = getPlan(state);

  const rows = entries.map((h) => {
    const meta = OUTCOME_META[h.outcome] ?? OUTCOME_META[OUTCOMES.PENDING];
    return `
      <div class="hist-row">
        <div class="hist-main">
          <div class="hist-opt">${esc(h.optionLabel)}</div>
          <div class="hist-sub">${showAll ? `${esc(h.categoryName)} · ` : ''}${relTime(h.at)}</div>
        </div>
        <span class="chip ${meta.chip}">${meta.label}</span>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="panel-head">
      <h3 class="panel-title">History</h3>
      <div class="panel-actions">
        <div class="seg">
          <button class="${!showAll ? 'active' : ''}" data-action="history-filter" data-filter="category" ${!cat ? 'disabled' : ''}>This</button>
          <button class="${showAll ? 'active' : ''}" data-action="history-filter" data-filter="all">All</button>
        </div>
        <button class="mini-btn" data-action="export-data" title="Download your data">
          Export${plan.canExport ? '' : '<span class="lock-tag">PRO</span>'}
        </button>
      </div>
    </div>
    <div class="hist-list">
      ${rows || `<div class="empty-note">No decisions yet.<br>Hit “Decide for me” and your log builds itself.</div>`}
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* modals                                                              */
/* ------------------------------------------------------------------ */

function openModal(html) {
  $('#modal-root').innerHTML = `
    <div class="modal-overlay" data-action="close-modal-overlay">
      <div class="modal glass">${html}</div>
    </div>
  `;
  $('#modal-root .modal input[type="text"]')?.focus();
}

function closeModal() { $('#modal-root').innerHTML = ''; }

function openAddCategoryModal() {
  if (!canAddCategory(state)) { openUpgradeModal('The free plan includes 3 categories.'); return; }
  modalEmoji = CATEGORY_EMOJIS[0];
  openModal(`
    <h2>New category</h2>
    <p class="modal-sub">A recurring decision you're tired of making.</p>
    <form data-form="create-category">
      <label>Name</label>
      <input type="text" name="name" placeholder="e.g. Friday takeout" maxlength="40" required>
      <label>Icon</label>
      <div class="emoji-row" id="emoji-row">
        ${CATEGORY_EMOJIS.map((e) => `<button type="button" class="${e === modalEmoji ? 'sel' : ''}" data-action="pick-emoji" data-emoji="${e}">${e}</button>`).join('')}
      </div>
      <label>Options <span style="text-transform:none;font-weight:500">(optional — one per line or comma-separated)</span></label>
      <textarea name="options" rows="4" placeholder="Tacos, Stir fry, Pasta night…"></textarea>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
        <button type="submit" class="btn btn-primary">Create</button>
      </div>
    </form>
  `);
}

function openUpgradeModal(reason = '') {
  openModal(`
    <h2>Go Pro ✨</h2>
    ${reason ? `<p class="modal-sub">${esc(reason)}</p>` : `<p class="modal-sub">Unlock the full picker.</p>`}
    <ul class="perks">
      <li><span class="tick">✓</span><span><strong>Unlimited categories</strong> — every recurring decision, covered.</span></li>
      <li><span class="tick">✓</span><span><strong>Surprise me</strong> — one tap draws across all your categories.</span></li>
      <li><span class="tick">✓</span><span><strong>Export</strong> — download your full history and preferences anytime.</span></li>
    </ul>
    <p class="price-line">$3<small> / month</small></p>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Not now</button>
      <button type="button" class="btn btn-primary" data-action="upgrade">Upgrade</button>
    </div>
    <p class="demo-note">Demo build — payments aren't wired up yet, so upgrading is instant and free.</p>
  `);
}

function openSettingsModal() {
  const pro = isPro(state);
  openModal(`
    <h2>Settings</h2>
    <p class="modal-sub">Everything is stored locally in this browser.</p>
    <div class="settings-row">
      <div>
        <div class="lbl">Plan: ${pro ? 'Pro ✨' : 'Free'}</div>
        <div class="desc">${pro ? 'Unlimited categories, export, and Surprise mode.' : `Free includes ${PLANS.free.maxCategories} categories. Pro unlocks unlimited categories, export, and Surprise mode.`}</div>
      </div>
      ${pro
        ? `<button class="mini-btn" data-action="downgrade">Switch to Free</button>`
        : `<button class="btn btn-primary" data-action="open-upgrade" style="padding:9px 16px;font-size:12.5px">Go Pro</button>`}
    </div>
    <div class="settings-row">
      <div>
        <div class="lbl">Export data</div>
        <div class="desc">Download categories, options and history as JSON.${pro ? '' : ' (Pro)'}</div>
      </div>
      <button class="mini-btn" data-action="export-data">Export${pro ? '' : '<span class="lock-tag">PRO</span>'}</button>
    </div>
    <div class="settings-row">
      <div>
        <div class="lbl">Start over</div>
        <div class="desc">Delete all categories, options and history from this browser.</div>
      </div>
      <button class="mini-btn danger" data-action="reset-all">Reset all data</button>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Done</button>
    </div>
  `);
}

/* ------------------------------------------------------------------ */
/* actions                                                             */
/* ------------------------------------------------------------------ */

/** Two-step inline confirm: first click arms the button, second executes. */
function confirmedClick(el, fn) {
  if (el.dataset.armed) { delete el.dataset.armed; fn(); return; }
  el.dataset.armed = '1';
  const original = el.innerHTML;
  el.innerHTML = 'Sure?';
  el.classList.add('confirming');
  setTimeout(() => {
    if (!el.isConnected) return;
    delete el.dataset.armed;
    el.innerHTML = original;
    el.classList.remove('confirming');
  }, 2200);
}

function exportData() {
  if (!getPlan(state).canExport) { openUpgradeModal('Exporting your history is a Pro feature.'); return; }
  const payload = {
    app: 'smart-decision-picker',
    exportedAt: new Date().toISOString(),
    categories: state.categories,
    history: state.history,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `decision-picker-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Export downloaded.');
}

const actions = {
  'select-category': (el) => {
    if (state.activeCategoryId === el.dataset.id) return;
    state.activeCategoryId = el.dataset.id;
    resetRound();
    commit();
    render();
  },
  'open-add-category': () => openAddCategoryModal(),
  'use-template': (el) => {
    const t = STARTER_TEMPLATES[Number(el.dataset.idx)];
    if (!t) return;
    if (state.categories.some((c) => c.name === t.name)) { toast(`"${t.name}" already exists.`); return; }
    if (createCategory(t.name, t.emoji, t.options)) {
      toast(`"${t.name}" is ready — hit Decide for me!`);
      render();
    }
  },
  'decide': () => { resetRound(); decide(); },
  'surprise': () => { resetRound(); decide({ surprise: true }); },
  'feedback': (el) => handleFeedback(el.dataset.outcome),
  'toggle-ban': (el) => {
    const cat = activeCategory();
    const opt = cat?.options.find((o) => o.id === el.dataset.id);
    if (!opt) return;
    opt.banned = !opt.banned;
    commit();
    render();
    toast(opt.banned ? `"${opt.label}" won't be suggested.` : `"${opt.label}" is back in the mix.`);
  },
  'delete-option': (el) => confirmedClick(el, () => {
    const cat = activeCategory();
    if (!cat) return;
    cat.options = cat.options.filter((o) => o.id !== el.dataset.id);
    commit();
    render();
  }),
  'delete-category': (el) => confirmedClick(el, () => {
    const cat = activeCategory();
    if (!cat) return;
    state.categories = state.categories.filter((c) => c.id !== cat.id);
    state.activeCategoryId = state.categories[0]?.id ?? null;
    resetRound();
    commit();
    render();
    toast(`Deleted "${cat.name}". Its history is kept in the All view.`);
  }),
  'history-filter': (el) => { historyFilter = el.dataset.filter; renderHistoryPanel(); },
  'export-data': () => exportData(),
  'open-settings': () => openSettingsModal(),
  'open-upgrade': () => openUpgradeModal(),
  'upgrade': () => {
    state.settings.plan = 'pro';
    commit();
    closeModal();
    render();
    toast('Welcome to Pro ✨ (demo unlock)');
  },
  'downgrade': () => {
    state.settings.plan = 'free';
    commit();
    closeModal();
    render();
    toast('Back on the Free plan.');
  },
  'reset-all': (el) => confirmedClick(el, () => {
    state = resetState();
    resetRound();
    closeModal();
    render();
    toast('Fresh start — all data cleared.');
  }),
  'close-modal': () => closeModal(),
  'pick-emoji': (el) => {
    modalEmoji = el.dataset.emoji;
    document.querySelectorAll('#emoji-row button').forEach((b) => b.classList.toggle('sel', b === el));
  },
};

document.addEventListener('click', (e) => {
  const overlay = e.target.classList?.contains('modal-overlay');
  if (overlay) { closeModal(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();

  if (form.dataset.form === 'add-option') {
    const cat = activeCategory();
    const input = form.querySelector('input[name="label"]');
    if (!cat || !input.value.trim()) return;
    const n = addOptions(cat, input.value);
    input.value = '';
    render();
    toast(n > 1 ? `Added ${n} options.` : n === 1 ? 'Option added.' : 'Already on the list.');
  }

  if (form.dataset.form === 'create-category') {
    const name = form.querySelector('input[name="name"]').value.trim();
    const optionsText = form.querySelector('textarea[name="options"]').value;
    if (!name) return;
    if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast('A category with that name already exists.');
      return;
    }
    const cat = createCategory(name, modalEmoji);
    if (!cat) return;
    if (optionsText.trim()) addOptions(cat, optionsText);
    closeModal();
    render();
    toast(`"${name}" created.`);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

render();
