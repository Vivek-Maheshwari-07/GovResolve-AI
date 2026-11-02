// Run: npm test   (no browser)
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusAsOf, issuedCount, courtCitation, reportText } from './lib/lineage.js';
import { STATUS } from './lib/status.js';

const base = { gr_id: 'base', gr_number: 'B', date: '2010-01-01', edges_out: [] };
const am1 = { gr_id: 'a1', gr_number: 'A1', date: '2015-05-01', edges_out: [{ to_gr_id: 'base', relation: 'amends', page: 1 }] };
const am2 = { gr_id: 'a2', gr_number: 'A2', date: '2020-05-01', edges_out: [{ to_gr_id: 'base', relation: 'amends', page: 2 }] };
const repl = { gr_id: 'r', gr_number: 'R', date: '2022-01-01', edges_out: [{ to_gr_id: 'a1', relation: 'supersedes', page: 1 }] };
const chain = [base, am1, am2, repl];

test('time machine: a document is amended only once an amending order exists', () => {
  assert.equal(statusAsOf(chain, '2012-01-01').base.status, 'no_change');
  assert.equal(statusAsOf(chain, '2016-01-01').base.status, 'amended');
  assert.equal(statusAsOf(chain, '').base.status, 'amended');
});

test('time machine: superseded beats amended, and only from the replacing order\'s date', () => {
  assert.equal(statusAsOf(chain, '2021-01-01').a1.status, 'no_change');
  assert.equal(statusAsOf(chain, '2022-06-01').a1.status, 'superseded');
});

test('time machine: documents issued after the date are flagged not issued', () => {
  const s = statusAsOf(chain, '2016-01-01');
  assert.equal(s.base.issued, true);
  assert.equal(s.a2.issued, false);
  assert.deepEqual(issuedCount(chain, '2016-01-01'), { issued: 2, total: 4 });
  assert.deepEqual(issuedCount(chain, ''), { issued: 4, total: 4 });
});

test('references alone never change a status', () => {
  const ref = { gr_id: 'x', date: '2019-01-01', edges_out: [{ to_gr_id: 'base', relation: 'refers_to' }] };
  assert.equal(statusAsOf([base, ref], '').base.status, 'no_change');
});

test('no status is called active or safe', () => {
  const text = JSON.stringify(STATUS);
  assert.ok(!/\bactive\b/i.test(text));
  assert.ok(!/\bsafe\b/i.test(text));
});

test('court citation keeps the verbatim quote, page and date', () => {
  const t = courtCitation({ gr_id: 'g', gr_number: 'GR-1', issue_date: '2022-09-29', page: 3, passage: 'relaxed by one year', department: 'GAD', subject: 'Rules' }, new Date('2026-11-02T00:00:00Z'));
  assert.match(t, /GR No\. GR-1, dated 2022-09-29, page 3/);
  assert.match(t, /“relaxed by one year”/);
  assert.match(t, /2026-11-02/);
  assert.match(reportText({ gr_id: 'g', page: 3, passage: 'q' }, 'my question'), /my question/);
});
