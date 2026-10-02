import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getConversionSequence, getConversionSuggestionPlans } from '../src/lib/conversion-gap-followups.ts';

const today = '2026-10-10';
const post = (id, date, bookings = 1, extra = {}) => ({
  id, date, businessId: 'mosaic', project: 'Insurance',
  performance: { views: 300, saves: 10, bookings }, ...extra,
});
const base = [post('early', '2026-09-01'), post('middle', '2026-09-04'), post('recent', '2026-09-07')];
const trust = post('trust', '2026-10-04', 1, { suggestionKind: 'trust', sourcePostId: 'recent' });

test('one trust proposal per service, linked to the latest post and never a discount first', () => {
  assert.deepEqual(getConversionSuggestionPlans(base.slice(0, 2), today), []);
  assert.deepEqual(getConversionSuggestionPlans(base, today), [{
    kind: 'trust', triggerPostId: 'recent', sourcePostId: 'recent',
    date: '2026-09-09', title: 'Insurance: a client testimonial',
  }]);
  assert.deepEqual(getConversionSuggestionPlans([base[0], { ...base[1], project: 'Divorce' }], today), []);
});

test('trust must run and have complete results before an offer becomes available', () => {
  assert.equal(getConversionSequence(base[2], [...base, { ...trust, performance: undefined }], today).stage, 'waiting-trust');
  assert.equal(getConversionSequence(base[2], [...base, trust], '2026-10-02').stage, 'waiting-trust');
  assert.equal(getConversionSequence(base[2], [...base, { ...trust, performance: { views: 300, saves: 10 } }], today).stage, 'waiting-trust');
  const plans = getConversionSuggestionPlans([...base, trust], today);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].kind, 'offer');
  assert.equal(plans[0].triggerPostId, 'trust');
  assert.equal(plans[0].sourcePostId, 'recent');
});

test('trust recovery clears the sequence instead of offering a discount', () => {
  const healthyTrust = { ...trust, performance: { views: 300, saves: 10, bookings: 30 } };
  assert.deepEqual(getConversionSuggestionPlans([...base, healthyTrust], today), []);
  assert.equal(getConversionSequence(healthyTrust, [...base, healthyTrust], today), undefined);
});

test('remembers existing trust approvals linked to an earlier post in the initial pattern', () => {
  const legacyTrust = { ...trust, sourcePostId: 'early' };
  assert.equal(getConversionSequence(base[2], [...base, { ...legacyTrust, performance: undefined }], today).stage, 'waiting-trust');
  assert.equal(getConversionSuggestionPlans([...base, legacyTrust], today)[0].kind, 'offer');
});

test('added trust and offer stages survive reload, never duplicate and never create a third stage', () => {
  const offer = post('offer', '2026-10-06', 0, { suggestionKind: 'offer', sourcePostId: 'recent' });
  const persisted = JSON.parse(JSON.stringify([...base, trust, offer]));
  assert.deepEqual(getConversionSuggestionPlans(persisted, today), []);
  assert.equal(getConversionSequence(offer, persisted, today).stage, 'waiting-offer');
});

test('a later gap after recovery starts at trust again without deleting earlier calendar posts', () => {
  const healthy = post('healthy', '2026-10-05', 30);
  const later = [
    ...base, trust, healthy, post('new1', '2026-10-06'), post('new2', '2026-10-07'), post('new3', '2026-10-08'),
  ];
  const plan = getConversionSuggestionPlans(later, today)[0];
  assert.equal(plan.kind, 'trust');
  assert.equal(plan.sourcePostId, 'new3');
  assert.equal(later.filter((post) => post.suggestionKind === 'trust').length, 1);
});

test('newer normal posts can keep the issue alive after trust; skipped follow-ups do not count', () => {
  const recent = post('after', '2026-10-07');
  assert.equal(getConversionSuggestionPlans([...base, trust, recent], today)[0].kind, 'offer');
  assert.equal(getConversionSuggestionPlans([...base, { ...trust, status: 'skipped' }], today)[0].kind, 'trust');
});