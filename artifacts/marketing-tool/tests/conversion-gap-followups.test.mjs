import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getConversionSuggestionPlans } from '../src/lib/conversion-gap-followups.ts';

const post = (id, date, bookings, project = 'Insurance') => ({
  id,
  date,
  businessId: 'mosaic',
  project,
  performance: { views: 100, saves: 10, bookings },
});

const base = [
  post('early', '2026-09-01', 0),
  post('middle', '2026-09-04', 4),
  post('recent', '2026-09-07', 4),
];

test('keeps the three measured-post gate and schedules one testimonial for the service', () => {
  assert.deepEqual(getConversionSuggestionPlans(base.slice(0, 2)), []);
  assert.deepEqual(getConversionSuggestionPlans(base), [{
    kind: 'trust',
    triggerPostId: 'early',
    sourcePostId: 'early',
    date: '2026-09-03',
    title: 'Insurance: a client testimonial',
  }]);
  assert.deepEqual(getConversionSuggestionPlans([base[0], post('divorce', '2026-09-04', 4, 'Divorce')]), []);
});

test('waits for testimonial results before adding a lower-barrier offer', () => {
  const trust = {
    id: 'trust', businessId: 'mosaic', project: 'Insurance', date: '2026-09-03',
    suggestionKind: 'trust', sourcePostId: 'early',
  };
  assert.deepEqual(getConversionSuggestionPlans([...base, trust]), []);
  const lowTrust = { ...trust, performance: { views: 100, saves: 10, bookings: 0 } };
  assert.deepEqual(getConversionSuggestionPlans([...base, lowTrust]), [{
    kind: 'offer',
    triggerPostId: 'trust',
    sourcePostId: 'early',
    date: '2026-09-05',
    title: 'Insurance: referral offer to book',
  }]);
  assert.deepEqual(getConversionSuggestionPlans([
    ...base, { ...trust, performance: { views: 100, saves: 10, bookings: 2 } },
  ]), []);
});

test('does not add duplicate offers or create a third stage', () => {
  const trust = {
    ...post('trust', '2026-09-03', 0),
    suggestionKind: 'trust', sourcePostId: 'early',
  };
  const offer = {
    ...post('offer', '2026-09-05', 0),
    suggestionKind: 'offer', sourcePostId: 'early',
  };
  assert.deepEqual(getConversionSuggestionPlans([...base, trust, offer]), []);
});