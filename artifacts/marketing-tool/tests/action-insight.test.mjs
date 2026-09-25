import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const post = (id, contentType, extra = {}) => ({
  id,
  businessId: 'mosaic',
  project: 'Insurance',
  title: `Post ${id}`,
  contentType,
  date: '2026-09-22',
  ...extra,
});

test('a logged announcement offers both strategic next beats without needing performance data', () => {
  const announcement = post('launch', 'Announcement');
  const insight = buildActionInsight('logged', announcement, [announcement], '2026-09-22');
  assert.equal(insight.proposals.length, 2);
  assert.deepEqual(insight.proposals.map(({ contentType, date }) => [contentType, date]), [
    ['Inside look', '2026-09-24'],
    ['Book now', '2026-09-27'],
  ]);
  assert.match(insight.recommendation, /inside the experience/);
  assert.match(insight.recommendation, /not claims about performance/);
});

test('each action recommends content sequence beats and cites available uploaded numbers', () => {
  const source = post('insight', 'Insight', { performance: { views: 100, saves: 10, bookings: 0 } });
  const result = buildActionInsight('results', source, [source], '2026-09-22');
  assert.match(result.evidence, /100 views, 10 saves, 0 bookings/);
  assert.deepEqual(result.proposals.map(({ contentType, date }) => [contentType, date]), [
    ['Book now', '2026-09-26'],
    ['Insight', '2026-10-01'],
  ]);
});

test('an existing move is highlighted while only genuinely missing moves are proposed', () => {
  const announcement = post('launch', 'Announcement');
  const existing = post('inside', 'Inside look', { date: '2026-09-25', title: 'Insurance: see the process' });
  const insight = buildActionInsight('logged', announcement, [announcement, existing], '2026-09-22');
  assert.equal(insight.title, 'Your next beat is already set');
  assert.match(insight.recommendation, /Your next beat is already set/);
  assert.match(insight.recommendation, /Your next beat is already set.*Insurance: see the process/);
  assert.equal(insight.beats[0].state, 'scheduled');
  assert.equal(insight.beats[0].title, existing.title);
  assert.equal(insight.proposals.length, 1);
  assert.equal(insight.proposals[0].contentType, 'Book now');
});

test('a matching post in another business or service does not suppress suggestions', () => {
  const announcement = post('launch', 'Announcement');
  const otherService = post('divorce', 'Inside look', { project: 'Divorce', date: '2026-09-25' });
  const otherBusiness = post('harbor', 'Book now', { businessId: 'harbor', date: '2026-09-27' });
  const insight = buildActionInsight('logged', announcement, [announcement, otherService, otherBusiness], '2026-09-22');
  assert.equal(insight.proposals.length, 2);
});

test('skipping offers to revisit the same content step without counting it as poor performance', () => {
  const skipped = post('skip', 'Announcement', { status: 'skipped' });
  const insight = buildActionInsight('skipped', skipped, [skipped], '2026-09-25');
  assert.match(insight.evidence, /marked it as skipped/);
  assert.match(insight.recommendation, /revisit it before moving/);
  assert.equal(insight.proposals.length, 1);
  assert.equal(insight.proposals[0].kind, 'reschedule');
  assert.equal(insight.proposals[0].date, '2026-09-27');
});

test('a skipped post with saved results asks for status review, not a reschedule', () => {
  const skipped = post('skip', 'Insight', {
    status: 'skipped',
    performance: { views: 100, saves: 10, bookings: 0 },
  });
  const insight = buildActionInsight('skipped', skipped, [skipped]);
  assert.match(insight.evidence, /100 views, 10 saves, 0 bookings/);
  assert.equal(insight.proposals.length, 0);
});

test('unknown content types get one fresh-angle follow-up', () => {
  const source = post('custom', 'Special topic');
  const insight = buildActionInsight('logged', source, [source]);
  assert.equal(insight.proposals.length, 1);
  assert.equal(insight.proposals[0].contentType, 'Fresh angle');
});