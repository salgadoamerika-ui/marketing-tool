import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBestTimeRecommendation } from '../src/lib/best-time.ts';

const post = ({
  businessId = 'mosaic',
  project = 'Tax planning',
  date = '2026-09-01',
  postedTime,
  views,
  extra = {},
}) => ({
  businessId,
  project,
  date,
  platforms: ['Facebook'],
  ...(postedTime ? { postedTime } : {}),
  performance: views === undefined ? undefined : { views },
  ...extra,
});

test('uses platform best-practice defaults below the three-performance-post gate', () => {
  const posts = [
    post({ postedTime: '09:00', views: 100 }),
    post({ postedTime: '10:00', views: 150 }),
  ];
  const recommendation = getBestTimeRecommendation('mosaic', 'Tax planning', ['Facebook'], posts);

  assert.equal(recommendation.mode, 'suggested');
  assert.equal(recommendation.label, 'Best time · suggested');
  assert.equal(recommendation.detail, 'Facebook: 9:00 AM');
  assert.doesNotMatch(recommendation.label, /results/i);
});

test('uses the best-practice defaults for every supported and custom platform', () => {
  const posts = [];
  const recommendation = getBestTimeRecommendation(
    'mosaic',
    'Tax planning',
    ['Facebook', 'Instagram', 'TikTok', 'Pinterest'],
    posts,
  );

  assert.equal(recommendation.mode, 'suggested');
  assert.equal(recommendation.detail, 'Facebook: 9:00 AM · Instagram: 11:00 AM · TikTok: 4:00 PM · Pinterest: 12:00 PM');
  assert.equal(
    getBestTimeRecommendation('mosaic', 'Tax planning', ['Other platform'], []).detail,
    'Other platform: 12:00 PM',
  );
});

test('learns the most common day and time window among the three highest-view posts', () => {
  const posts = [
    post({ date: '2026-09-01', postedTime: '09:00', views: 600 }),
    post({ date: '2026-09-08', postedTime: '10:30', views: 500 }),
    post({ date: '2026-09-15', postedTime: '11:45', views: 400 }),
    post({ date: '2026-09-11', postedTime: '19:00', views: 80 }),
  ];
  const recommendation = getBestTimeRecommendation('mosaic', 'Tax planning', ['Facebook'], posts);

  assert.equal(recommendation.mode, 'learned');
  assert.equal(recommendation.label, 'Best time · from your results: Tuesday mornings');
  assert.match(recommendation.detail, /3 highest-view posts/);
});

test('stays in suggested mode when there are three results but not three timed top performers', () => {
  const posts = [
    post({ date: '2026-09-01', postedTime: '09:00', views: 600 }),
    post({ date: '2026-09-08', postedTime: '10:30', views: 500 }),
    post({ date: '2026-09-15', views: 400 }),
  ];
  const recommendation = getBestTimeRecommendation('mosaic', 'Tax planning', ['Instagram'], posts);

  assert.equal(recommendation.mode, 'suggested');
  assert.equal(recommendation.detail, 'Instagram: 11:00 AM');
  assert.doesNotMatch(recommendation.label, /results/i);
});

test('does not infer a personalized pattern from three all-zero view results', () => {
  const posts = [
    post({ date: '2026-09-01', postedTime: '09:00', views: 0 }),
    post({ date: '2026-09-08', postedTime: '10:30', views: 0 }),
    post({ date: '2026-09-15', postedTime: '11:45', views: 0 }),
  ];
  const recommendation = getBestTimeRecommendation('mosaic', 'Tax planning', ['TikTok'], posts);

  assert.equal(recommendation.mode, 'suggested');
  assert.equal(recommendation.detail, 'TikTok: 4:00 PM');
  assert.doesNotMatch(recommendation.label, /results/i);
});

test('excludes skipped posts and other services or businesses from the learned timing pattern', () => {
  const posts = [
    post({ date: '2026-09-01', postedTime: '09:00', views: 600 }),
    post({ date: '2026-09-08', postedTime: '10:30', views: 500 }),
    post({ date: '2026-09-15', postedTime: '11:45', views: 400 }),
    post({ date: '2026-09-22', postedTime: '20:00', views: 10, extra: { status: 'skipped' } }),
    post({ date: '2026-09-22', postedTime: '20:00', views: 1000, extra: { project: 'Insurance' } }),
    post({ date: '2026-09-22', postedTime: '20:00', views: 1000, extra: { businessId: 'harbor' } }),
  ];
  const recommendation = getBestTimeRecommendation('mosaic', 'Tax planning', ['Facebook'], posts);

  assert.equal(recommendation.mode, 'learned');
  assert.equal(recommendation.label, 'Best time · from your results: Tuesday mornings');
});