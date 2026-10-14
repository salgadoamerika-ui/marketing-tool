import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSkipSuggestionWeight, shouldSuggestContentType } from '../src/lib/skip-preferences.ts';
import { buildSkipAlternativeInsight } from '../src/lib/skip-alternative.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';
import { getOverperformer } from '../src/lib/overperformer.ts';

const post = (id, extra = {}) => ({
  id, businessId: 'one', project: 'Tax', title: id, contentType: 'Testimonial',
  date: '2026-09-22', ...extra,
});
const service = { id: 'tax', businessId: 'one', name: 'Tax', mode: 'evergreen' };
const types = ['Announcement', 'Testimonial', 'Proof', 'Inside look', 'Insight', 'Recap', 'Repost', 'Boost'];
const skipped = (id, extra = {}) => post(id, { status: 'skipped', date: '2026-09-01', ...extra });

test('one skip gently reduces its type; repeated skips lower frequency but never ban it', () => {
  const source = post('source');
  const history = Array.from({ length: 8 }, (_, index) => skipped(`skip-${index}`));
  assert.equal(getSkipSuggestionWeight(source, [], 'Testimonial'), 1);
  assert.equal(getSkipSuggestionWeight(source, history.slice(0, 1), 'Testimonial'), .8);
  assert.ok(getSkipSuggestionWeight(source, history.slice(0, 2), 'Testimonial') < .8);
  assert.equal(getSkipSuggestionWeight(source, history, 'Testimonial'), .35);
  const sources = Array.from({ length: 1000 }, (_, index) => post(`source-${index}`));
  const once = sources.filter((item) => shouldSuggestContentType(item, history.slice(0, 1), 'Testimonial'));
  const repeated = sources.filter((item) => shouldSuggestContentType(item, history, 'Testimonial'));
  assert.ok(once.length > 600 && once.length < 950);
  assert.ok(repeated.length > 150 && repeated.length < once.length);
  assert.ok(repeated.every((item) => shouldSuggestContentType(item, history.slice(0, 1), 'Testimonial')), 'More skips cannot re-enable a suppressed proposal');
});

test('preferences are isolated by business, service, and exact content type, and undo removes the signal', () => {
  const source = post('source');
  const records = [
    skipped('other-business', { businessId: 'two' }),
    skipped('other-service', { project: 'Insurance' }),
    skipped('other-type', { contentType: 'Boost' }),
    post('planned'), post('done', { status: 'completed' }),
  ];
  assert.equal(getSkipSuggestionWeight(source, records, 'Testimonial'), 1);
  assert.equal(getSkipSuggestionWeight(source, [...records, skipped('own')], 'Testimonial'), .8);
  assert.equal(getSkipSuggestionWeight(source, [...records, post('own')], 'Testimonial'), 1);
});

test('the existing sequence engine generates fewer skipped-type proposals, without changing other beats', () => {
  const history = [skipped('skip-one'), skipped('skip-two')];
  let testimonials = 0;
  for (let index = 0; index < 200; index++) {
    const source = post(`sequence-${index}`, { contentType: 'Inside look' });
    const insight = buildActionInsight('completed', source, [source, ...history], source.date);
    testimonials += insight.proposals.filter((item) => item.contentType === 'Testimonial').length;
    assert.ok(insight.proposals.some((item) => item.contentType === 'Book now'));
    assert.deepEqual(insight, buildActionInsight('completed', source, [source, ...history], source.date), 'Refreshes are stable');
  }
  assert.ok(testimonials > 0 && testimonials < 200);
});

test('skipping a testimonial offers exactly one lighter proof post, and a paid skip offers an organic repost', () => {
  const testimonial = skipped('testimonial');
  const result = buildSkipAlternativeInsight(testimonial, [testimonial], '2026-09-22', [], [service], types);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].contentType, 'Proof');
  assert.match(result.recommendation, /quick proof post is lighter/);
  const boost = skipped('boost', { contentType: 'Boost', distribution: 'paid' });
  const alternative = buildSkipAlternativeInsight(boost, [boost], '2026-09-22', [], [service], types);
  assert.equal(alternative.proposals.length, 1);
  assert.equal(alternative.proposals[0].contentType, 'Repost');
  assert.equal(alternative.proposals[0].distribution, 'organic');
  assert.match(alternative.recommendation, /No boost\? Try an organic repost/);
});

test('alternatives respect deleted types, duplicates, business walls, and Campaign deadlines', () => {
  const source = skipped('source');
  assert.equal(buildSkipAlternativeInsight(source, [source], '2026-09-22', [], [service], []).proposals.length, 0);
  const existing = post('proof', { contentType: 'Proof', date: '2026-09-24' });
  const duplicate = buildSkipAlternativeInsight(source, [source, existing], '2026-09-22', [], [service], types);
  assert.equal(duplicate.proposals.length, 0);
  assert.equal(duplicate.beats[0].state, 'scheduled');
  assert.equal(buildSkipAlternativeInsight(source, [source, { ...existing, businessId: 'two' }], '2026-09-22', [], [service], types).proposals.length, 1);
  const campaign = { ...service, mode: 'campaign', startDate: '2026-09-01', endDate: '2026-09-23' };
  const closing = buildSkipAlternativeInsight(source, [source], '2026-09-22', [], [campaign], types);
  assert.ok(closing.proposals.every((item) => item.date <= campaign.endDate));
  assert.equal(buildSkipAlternativeInsight(source, [source], '2026-09-24', [], [campaign], types).proposals.length, 0);
});

test('skipped results are not counted as published performance or an overperformer', () => {
  const source = post('winner', { performance: { views: 1000 } });
  const history = [post('a', { performance: { views: 100 } }), skipped('b', { performance: { views: 100 } })];
  assert.equal(getOverperformer(source, [source, ...history]), null, 'Only two real results remain, below the honesty gate');
  assert.equal(getOverperformer({ ...source, status: 'skipped' }, [source, ...history]), null);
});
