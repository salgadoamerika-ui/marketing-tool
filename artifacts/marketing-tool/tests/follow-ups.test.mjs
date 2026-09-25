import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFollowUpPlans } from '../src/lib/follow-ups.ts';

const source = {
  id: 'source',
  businessId: 'mosaic',
  project: 'Insurance',
  contentType: 'Announcement',
  date: '2026-09-29',
  title: 'Insurance launch',
};

test('announcement plans an inside look in two days and a booking ask in five', () => {
  assert.deepEqual(getFollowUpPlans(source, [source]), [
    { contentType: 'Inside look', label: 'show them inside', date: '2026-10-01' },
    { contentType: 'Book now', label: 'make the ask', date: '2026-10-04' },
  ]);
});

test('maps each playbook type to its strategic next beats and offsets', () => {
  const cases = [
    ['Inside look', [['Testimonial', 2], ['Book now', 4]]],
    ['Book now', [['Testimonial', 3], ['Pricing', 6]]],
    ['Enrollment', [['Testimonial', 3], ['Pricing', 6]]],
    ['Pricing', [['Promo', 4]]],
    ['Testimonial', [['Book now', 3]]],
    ['Proof', [['Book now', 3]]],
    ['Insight', [['Book now', 4], ['Insight', 9]]],
    ['Recap', [['Fresh angle', 5]]],
  ];
  for (const [contentType, expected] of cases) {
    const plans = getFollowUpPlans({ ...source, contentType }, [{ ...source, contentType }]);
    assert.deepEqual(plans.map((plan) => [
      plan.contentType,
      (Date.parse(`${plan.date}T00:00:00Z`) - Date.parse(`${source.date}T00:00:00Z`)) / 86400000,
    ]), expected, contentType);
  }
});

test('recognizes a matching beat already on the service calendar during the next week', () => {
  const existing = {
    ...source,
    id: 'existing',
    contentType: 'Inside look',
    date: '2026-10-05',
    title: 'The process, inside',
  };
  const plans = getFollowUpPlans(source, [source, existing]);
  assert.deepEqual(plans[0], {
    contentType: 'Inside look',
    label: 'show them inside',
    date: existing.date,
    existingPostId: existing.id,
    existingPostTitle: existing.title,
  });
  assert.equal(plans[1].existingPostId, undefined);
});

test('Proof and Testimonial count as the same trust beat for duplicate prevention', () => {
  const bookNow = { ...source, id: 'book', contentType: 'Book now' };
  const proof = { ...source, id: 'proof', contentType: 'Proof', date: '2026-10-02' };
  assert.equal(getFollowUpPlans(bookNow, [bookNow, proof])[0].existingPostId, 'proof');
});

test('posts in another service or business do not suppress a matching beat', () => {
  const sameTypeOtherService = { ...source, id: 'other-service', project: 'Divorce', contentType: 'Inside look', date: '2026-10-01' };
  const sameTypeOtherBusiness = { ...source, id: 'other-business', businessId: 'harbor', contentType: 'Book now', date: '2026-10-04' };
  assert.equal(getFollowUpPlans(source, [source, sameTypeOtherService, sameTypeOtherBusiness])
    .filter((plan) => !plan.existingPostId).length, 2);
});

test('moves a suggestion forward when its intended day is occupied', () => {
  const plans = getFollowUpPlans(source, [source], ['2026-10-01']);
  assert.equal(plans[0].date, '2026-10-02');
});

test('marks a beat unavailable instead of placing it on a busy date after a week of nudging', () => {
  const occupied = Array.from({ length: 8 }, (_, index) => {
    const date = new Date('2026-10-01T12:00:00');
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const plans = getFollowUpPlans(source, [source], occupied);
  assert.equal(plans[0].blocked, true);
});

test('does not suggest another fresh-angle follow-up forever', () => {
  const fresh = { ...source, contentType: 'Fresh angle' };
  assert.deepEqual(getFollowUpPlans(fresh, [fresh]), []);
});