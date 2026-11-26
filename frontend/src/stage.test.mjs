// Run: npm test   (no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isStage, loadCache, saveCache, pinState, answeredAt, preflight } from './lib/stage.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('stage mode is on only for ?stage=1', () => {
  assert.equal(isStage('?stage=1'), true);
  assert.equal(isStage('?stage=0'), false);
  assert.equal(isStage('?intro=1'), false);
  assert.equal(isStage(''), false);
});

test('cache survives a round trip and never throws on bad or missing storage', () => {
  const s = memory();
  assert.deepEqual(loadCache(s), {});
  assert.equal(saveCache(s, { p1: { at: 1, response: { verdict: 'answered' } } }), true);
  assert.equal(loadCache(s).p1.response.verdict, 'answered');
  s.setItem('govresolve.stage.v1', '{not json');
  assert.deepEqual(loadCache(s), {});
  s.setItem('govresolve.stage.v1', '[1,2]');
  assert.deepEqual(loadCache(s), {});
  assert.deepEqual(loadCache(null), {});
  assert.equal(saveCache({ setItem: () => { throw new Error('full'); } }, {}), false);
});

test('pin state and timestamp label', () => {
  assert.equal(pinState(undefined), 'pending');
  assert.equal(pinState({ at: 1, error: 'boom' }), 'error');
  assert.equal(pinState({ at: 1, response: { verdict: 'insufficient_evidence' } }), 'ready');
  assert.match(answeredAt(Date.UTC(2026, 10, 27, 5, 12)), /^answered \d{2}:\d{2}$/);
  assert.equal(answeredAt(null), '');
  assert.equal(answeredAt('nope'), '');
});

test('preflight reads only real health figures', () => {
  assert.deepEqual(preflight(null), [{ label: 'Server', ok: false, detail: 'not reachable' }]);
  const p = preflight({ status: 'ok', gr_count: 366, edge_count: 210, bad_files: [] });
  assert.deepEqual(p.map((x) => x.ok), [true, true, true, true]);
  assert.equal(p[1].detail, '366');
  assert.equal(preflight({ status: 'ok', gr_count: 0, edge_count: 0, bad_files: ['a.json'] }).filter((x) => !x.ok).length, 3);
});

test('no stage label calls a rule active or safe', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('./lib/stage.js', import.meta.url), 'utf8');
  assert.ok(!/['"`][^'"`]*\b(active|safe)\b[^'"`]*['"`]/i.test(src));
});
