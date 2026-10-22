import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bestCampaignLearningPost,
  campaignCycleForYear,
  campaignNameForCycle,
  cycleForCampaignName,
  findDormantCampaignMatch,
  handledWakeCycle,
  isCampaignWakeCycleOpen,
  nextCampaignWakeCycle,
} from '../src/lib/campaign-wakeups.ts';
import { markExpiredCampaignsDormant, normalizeService } from '../src/lib/services.ts';
import { buildActionInsight } from '../src/lib/action-insight.ts';

const dormant = {
  id: 'summer-2026',
  businessId: 'mosaic',
  name: 'Summer Camp 2026',
  mode: 'campaign',
  startDate: '2026-06-01',
  endDate: '2026-08-31',
  status: 'dormant',
  dormantSince: '2026-09-01',
};

test('expired campaigns become dormant without dropping their dates or retained learning metadata', () => {
  const campaign = { ...dormant, status: 'active', wakeSourcePostId: 'post-7' };
  assert.deepEqual(markExpiredCampaignsDormant([campaign], '2026-09-01'), [
    { ...campaign, status: 'dormant', dormantSince: '2026-09-01' },
  ]);
  assert.deepEqual(normalizeService(campaign), campaign);
});

test('a campaign wake window follows the next full annual date range and stops after a handled cycle', () => {
  const next = nextCampaignWakeCycle(dormant, '2027-04-01');
  assert.deepEqual(next, {
    cycleKey: 'summer-2026:2027-06-01',
    startDate: '2027-06-01',
    endDate: '2027-08-31',
  });
  assert.equal(isCampaignWakeCycleOpen(dormant, next, '2027-05-31'), false);
  assert.equal(isCampaignWakeCycleOpen(dormant, next, '2027-06-01'), true);
  const handled = { ...dormant, wakeUpHandledCycles: handledWakeCycle(dormant, next.cycleKey) };
  assert.equal(isCampaignWakeCycleOpen(handled, next, '2027-06-01'), false);
  assert.equal(nextCampaignWakeCycle(dormant, '2027-09-01').startDate, '2028-06-01');
});

test('annual cycle calculation preserves campaign length and clamps leap-day starts safely', () => {
  const february = { ...dormant, startDate: '2024-02-29', endDate: '2024-03-10' };
  assert.deepEqual(campaignCycleForYear(february, 2025), {
    cycleKey: 'summer-2026:2025-02-28',
    startDate: '2025-02-28',
    endDate: '2025-03-10',
  });
});

test('year-matched campaign names find dormant campaigns only inside the same business', () => {
  const otherBusiness = { ...dormant, id: 'northline-summer', businessId: 'northline' };
  assert.equal(findDormantCampaignMatch('Summer Camp 2027', [dormant, otherBusiness], 'mosaic')?.id, dormant.id);
  assert.deepEqual(cycleForCampaignName(dormant, 'Summer Camp 2027', '2026-10-22'), {
    cycleKey: 'summer-2026:2027-06-01',
    startDate: '2027-06-01',
    endDate: '2027-08-31',
  });
  assert.equal(campaignNameForCycle(dormant.name, { cycleKey: 'x', startDate: '2027-06-01', endDate: '2027-08-31' }),
    'Summer Camp 2027');
  assert.equal(findDormantCampaignMatch('Summer Camp 2027', [otherBusiness], 'mosaic'), undefined);
});

test('wake plans use the strongest measured post first and retain a latest-post fallback', () => {
  const posts = [
    { id: 'low', businessId: 'mosaic', project: dormant.name, date: '2026-06-02', contentType: 'Announcement', performance: { views: 40, bookings: 0 } },
    { id: 'winner', businessId: 'mosaic', project: dormant.name, date: '2026-07-02', contentType: 'Proof', performance: { views: 500, bookings: 5 } },
    { id: 'other-business', businessId: 'northline', project: dormant.name, date: '2026-07-03', contentType: 'Insight', performance: { views: 900, bookings: 9 } },
  ];
  assert.equal(bestCampaignLearningPost(dormant, posts)?.id, 'winner');
  assert.equal(bestCampaignLearningPost(dormant, posts.slice(0, 1))?.id, 'low');
  const active = { ...dormant, status: 'active', startDate: '2027-06-01', endDate: '2027-08-31', wakeSourcePostId: 'winner' };
  const seed = { ...posts[1], date: '2027-06-01' };
  const next = buildActionInsight('completed', seed, posts, '2027-06-01', [], [active]);
  assert.equal(next.proposals[0]?.contentType, 'Proof');
});
