import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSeasonalityFinding } from '../src/lib/seasonality.ts';

const post = (businessId, project, date, views, extra = {}) => ({
  businessId,
  project,
  date,
  performance: { views },
  ...extra,
});

test('finds a recurring January spike across two years with a strong off-season comparison', () => {
  const posts = [
    post('mosaic', 'Tax planning', '2024-01-12', 200),
    post('mosaic', 'Tax planning', '2024-04-12', 100),
    post('mosaic', 'Tax planning', '2024-08-12', 100),
    post('mosaic', 'Tax planning', '2025-01-12', 240),
    post('mosaic', 'Tax planning', '2025-04-12', 120),
    post('mosaic', 'Tax planning', '2025-08-12', 120),
  ];

  assert.deepEqual(
    findSeasonalityFinding('mosaic', 'Tax planning', posts, []),
    {
      month: 1,
      yearsObserved: [2024, 2025],
      averageViews: 220,
      comparisonAverageViews: 110,
      lift: 2,
    },
  );
});

test('does not infer a season from one year or from inconsistent yearly results', () => {
  const oneYear = [
    post('mosaic', 'Tax planning', '2024-01-12', 300),
    post('mosaic', 'Tax planning', '2024-04-12', 100),
    post('mosaic', 'Tax planning', '2024-08-12', 100),
  ];
  assert.equal(findSeasonalityFinding('mosaic', 'Tax planning', oneYear, []), null);

  const inconsistent = [
    ...oneYear,
    post('mosaic', 'Tax planning', '2025-01-12', 100),
    post('mosaic', 'Tax planning', '2025-04-12', 100),
    post('mosaic', 'Tax planning', '2025-08-12', 100),
  ];
  assert.equal(findSeasonalityFinding('mosaic', 'Tax planning', inconsistent, []), null);
});

test('does not suggest a month already set by the user', () => {
  const posts = [
    post('mosaic', 'Tax planning', '2024-01-12', 200),
    post('mosaic', 'Tax planning', '2024-04-12', 100),
    post('mosaic', 'Tax planning', '2024-08-12', 100),
    post('mosaic', 'Tax planning', '2025-01-12', 240),
    post('mosaic', 'Tax planning', '2025-04-12', 120),
    post('mosaic', 'Tax planning', '2025-08-12', 120),
  ];

  assert.equal(findSeasonalityFinding('mosaic', 'Tax planning', posts, [1]), null);
});

test('ignores skipped posts, other businesses, other services, and invalid dates', () => {
  const posts = [
    post('mosaic', 'Tax planning', '2024-01-12', 200),
    post('mosaic', 'Tax planning', '2024-04-12', 100),
    post('mosaic', 'Tax planning', '2024-08-12', 100),
    post('mosaic', 'Tax planning', '2025-01-12', 240),
    post('mosaic', 'Tax planning', '2025-04-12', 120),
    post('mosaic', 'Tax planning', '2025-08-12', 120),
    post('mosaic', 'Tax planning', '2025-01-20', 1_000, { status: 'skipped' }),
    post('harbor', 'Tax planning', '2025-01-20', 1_000),
    post('mosaic', 'Insurance', '2025-01-20', 1_000),
    post('mosaic', 'Tax planning', '2025-02-30', 1_000),
  ];

  assert.equal(findSeasonalityFinding('mosaic', 'Tax planning', posts, [])?.month, 1);
});