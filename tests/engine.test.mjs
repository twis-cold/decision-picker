import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTCOMES, deriveStats, weightFor, weightedPick, oddsShare } from '../js/engine.js';

const opt = (id, banned = false) => ({ id, label: id, banned });
const entry = (optionId, outcome) => ({ optionId, outcome });

test('banned options have zero weight and are never picked', () => {
  assert.equal(weightFor(opt('a', true), []), 0);
  const items = [opt('a', true), opt('b', true)];
  assert.equal(weightedPick(items, (o) => weightFor(o, [])), null);
});

test('loved options weigh more than neutral; skipped weigh less', () => {
  const history = [
    entry('loved-one', OUTCOMES.LOVED),
    entry('skipped-one', OUTCOMES.SKIPPED),
    entry('neutral-one', OUTCOMES.FINE),
  ];
  // push history far enough back that recency penalties don't apply
  const padded = [entry('x', OUTCOMES.FINE), entry('x', OUTCOMES.FINE), entry('x', OUTCOMES.FINE), ...history];
  const w = (id) => weightFor(opt(id), padded);
  assert.ok(w('loved-one') > w('neutral-one'), 'loved > fine');
  assert.ok(w('skipped-one') < w('neutral-one'), 'skipped < fine');
  assert.ok(w('skipped-one') > 0, 'skipped can still resurface');
});

test('recently suggested options are deprioritized', () => {
  const history = [entry('recent', OUTCOMES.FINE)]; // most recent suggestion
  const recent = weightFor(opt('recent'), history);
  // same single "fine" outcome, but 3 suggestions ago -> no recency penalty
  const fresh = weightFor(opt('fresh-pick'), [entry('a', 'fine'), entry('b', 'fine'), entry('c', 'fine'), entry('fresh-pick', OUTCOMES.FINE)]);
  assert.ok(recent < fresh, `just-suggested (${recent}) should weigh less than long-ago (${fresh})`);
});

test('never-tried options get an exploration bonus', () => {
  const history = [entry('a', OUTCOMES.FINE), entry('b', OUTCOMES.FINE), entry('c', OUTCOMES.FINE), entry('tried', OUTCOMES.FINE)];
  assert.ok(weightFor(opt('brand-new'), history) > weightFor(opt('tried'), history));
});

test('deriveStats tallies outcomes', () => {
  const history = [
    entry('a', OUTCOMES.LOVED),
    entry('a', OUTCOMES.SKIPPED),
    entry('a', OUTCOMES.FINE),
    entry('a', OUTCOMES.PENDING),
    entry('other', OUTCOMES.LOVED),
  ];
  assert.deepEqual(deriveStats('a', history), { loves: 1, fines: 1, skips: 1, picks: 3, suggestions: 4 });
});

test('weightedPick respects weights with a seeded rng', () => {
  const items = ['low', 'high'];
  const weights = { low: 1, high: 9 };
  // rng = 0.5 -> r = 5 -> falls in "high" bucket (after low's 1)
  assert.equal(weightedPick(items, (i) => weights[i], () => 0.5), 'high');
  // rng = 0.05 -> r = 0.5 -> falls in "low" bucket
  assert.equal(weightedPick(items, (i) => weights[i], () => 0.05), 'low');
});

test('weightedPick distribution roughly follows weights', () => {
  const items = [opt('loved'), opt('meh')];
  const history = [
    ...Array(4).fill(entry('pad', OUTCOMES.FINE)), // pad so recency doesn't interfere
    entry('loved', OUTCOMES.LOVED), entry('loved', OUTCOMES.LOVED),
    entry('meh', OUTCOMES.SKIPPED), entry('meh', OUTCOMES.SKIPPED),
  ];
  let lovedWins = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    if (weightedPick(items, (o) => weightFor(o, history))?.id === 'loved') lovedWins++;
  }
  // loved weight ≈ 1.35² = 1.82; meh ≈ 0.55² = 0.30 → loved should win ~86% of the time
  assert.ok(lovedWins / N > 0.7, `loved won only ${(lovedWins / N * 100).toFixed(1)}%`);
});

test('oddsShare normalizes to 1 across usable options', () => {
  const options = [opt('a'), opt('b'), opt('banned', true)];
  const shares = oddsShare(options, []);
  const total = [...shares.values()].reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.equal(shares.get('banned'), 0);
});
