import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  initializeLegacyWorkspace,
  legacyBusinessIdentities,
  legacySampleServiceIds,
} from '../src/lib/legacy-workspace.ts';
import { firstRunStorageKey, shouldOfferFirstRun } from '../src/lib/first-run.ts';
import { createBusinessContentSettings } from '../src/lib/business-content-settings.ts';
import { serviceSeasonKey } from '../src/lib/service-seasons.ts';

const demoServices = legacySampleServiceIds.map((id) => {
  const [businessId, name] = id.split(':');
  return { id, businessId, name, mode: 'evergreen' };
});
const initialize = (services = null, posts = [], businesses = [], catalogs = {}, seasons = {}) =>
  initializeLegacyWorkspace(services === null ? null : JSON.stringify(services), posts, businesses, catalogs, seasons);

test('blank and skipped-setup workspaces stay empty, including after reload', () => {
  for (const marker of [null, 'skipped', 'completed']) {
    const storage = { getItem: (key) => key === firstRunStorageKey ? marker : null };
    assert.equal(shouldOfferFirstRun(storage, legacySampleServiceIds), marker === null);
    const first = initialize();
    assert.deepEqual(first, { services: [], recoveredBusinesses: [] });
    assert.deepEqual(initialize(first.services), first);
  }
});

test('all untouched legacy defaults are removed without recovering demo tabs', () => {
  const catalogs = Object.fromEntries(legacyBusinessIdentities.map(({ id }) =>
    [id, createBusinessContentSettings()]));
  const first = initialize(demoServices, [], [], catalogs);
  assert.deepEqual(first, { services: [], recoveredBusinesses: [] });
  assert.equal(demoServices.length, 15, 'migration must not mutate its inputs');
  assert.deepEqual(initialize(first.services, [], [], catalogs), first);
});

test('globally inherited platforms do not recover demo tabs, but business-specific edits still do', () => {
  const globalPlatforms = ['Facebook', 'Instagram', 'TikTok', 'LinkedIn'];
  const catalogs = Object.fromEntries(legacyBusinessIdentities.map(({ id }) =>
    [id, createBusinessContentSettings(undefined, globalPlatforms)]));
  const before = structuredClone({ catalogs, globalPlatforms });
  const run = () => initializeLegacyWorkspace(JSON.stringify(demoServices), [], [], catalogs, {}, globalPlatforms);
  assert.deepEqual(run(), { services: [], recoveredBusinesses: [] });
  assert.deepEqual({ catalogs, globalPlatforms }, before, 'global settings are not changed');
  for (const edit of [
    { contentTypes: ['My custom format'] },
    { platformOptions: [...globalPlatforms, 'Threads'] },
    { platformOptions: ['Instagram'] },
    { selectedPlatforms: ['Instagram', 'LinkedIn'] },
    { contentTypeAliases: { Announcement: 'News' } },
  ]) {
    catalogs.mosaic = { ...before.catalogs.mosaic, ...edit };
    const result = run();
    assert.deepEqual(result.recoveredBusinesses.map(({ id }) => id), ['mosaic']);
    assert.equal(result.services.length, 5);
    assert.deepEqual(catalogs.mosaic, { ...before.catalogs.mosaic, ...edit });
  }
});

test('real posts on each former demo remain reachable with results, skips and suggestion history unchanged', () => {
  const posts = legacyBusinessIdentities.map(({ id }, index) => ({
    id: `real-${id}`, businessId: id, project: index === 0 ? 'Insurance' : 'My service',
    title: 'A saved post', date: '2026-09-10', contentType: 'Insight',
    platforms: ['Instagram'], distribution: 'organic',
    performance: { views: 123, saves: 12, bookings: 3 },
    status: index === 1 ? 'skipped' : 'completed',
    sourcePostId: 'earlier-post', suggestionKind: 'repost',
  }));
  const snapshot = structuredClone(posts);
  const first = initialize(demoServices, posts);
  assert.deepEqual(first.recoveredBusinesses, legacyBusinessIdentities);
  assert.equal(first.services.length, 3, 'only services with real posts survive or are recovered');
  for (const post of posts) {
    assert.ok(first.recoveredBusinesses.some((business) => business.id === post.businessId));
    assert.ok(first.services.some((service) => service.businessId === post.businessId && service.name === post.project));
  }
  assert.deepEqual(posts, snapshot);
  const reloaded = initialize(first.services, posts, first.recoveredBusinesses);
  assert.deepEqual(reloaded.services, first.services);
  assert.deepEqual(reloaded.recoveredBusinesses, [], 'persisted recovery tabs must not duplicate');
});

test('existing businesses and their services survive, including saved former-demo IDs', () => {
  const businesses = [{ id: 'my-shop', name: 'My shop' }, { id: 'mosaic', name: 'My renamed workspace' }];
  const services = [
    { id: 'user-service', businessId: 'my-shop', name: 'Insurance', mode: 'evergreen', platforms: ['TikTok'], tone: 'blue' },
    demoServices[0],
  ];
  const snapshot = structuredClone({ businesses, services });
  const result = initialize([...services, ...demoServices.filter((s) => s.businessId !== 'mosaic')], [], businesses);
  assert.deepEqual(result.services, services);
  assert.deepEqual(result.recoveredBusinesses, []);
  assert.deepEqual({ businesses, services }, snapshot);
});

test('edits, campaigns, seasonal choices and custom catalogs are not disposable samples', () => {
  const campaign = {
    ...demoServices[0], mode: 'campaign', startDate: '2025-01-01', endDate: '2025-01-31',
    status: 'dormant', wakeUpHandledCycles: ['2026'], wakeSourcePostId: 'best-post',
    campaignHistory: [{ name: 'Past cycle', startDate: '2024-01-01', endDate: '2024-01-31', postIds: ['old-post'] }],
  };
  for (const service of [
    { ...demoServices[0], platforms: ['Instagram'] },
    { ...demoServices[0], tone: 'sage' },
    { ...demoServices[0], name: 'Renamed by user' },
    { ...demoServices[0], id: 'user-created-same-name' },
    campaign,
  ]) {
    const result = initialize([service]);
    assert.deepEqual(result.services, [service]);
    assert.equal(result.recoveredBusinesses[0].id, service.businessId);
  }
  const catalogs = { harbor: { ...createBusinessContentSettings(), contentTypes: ['My custom format'] } };
  const seasons = { [serviceSeasonKey('northline', 'Insurance')]: [4, 5] };
  const snapshot = structuredClone({ catalogs, seasons });
  const result = initialize(demoServices, [], [], catalogs, seasons);
  assert.deepEqual(result.recoveredBusinesses.map((business) => business.id), ['northline', 'harbor']);
  assert.ok(result.services.some((service) => service.businessId === 'northline' && service.name === 'Insurance'));
  assert.deepEqual({ catalogs, seasons }, snapshot);
});

test('invalid saved services fail explicitly rather than overwriting user data', () => {
  assert.throws(() => initializeLegacyWorkspace('invalid JSON', [], []));
  assert.throws(() => initializeLegacyWorkspace('{}', [], []), /could not be read/);
  assert.throws(() => initialize([{ id: 'broken' }]), /invalid/);
});

test('calendar, airtime and learning have no built-in sample events in either view', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /sampleBusinesses|seededCalendar|activeSeeded|resolveSeededContentType|business\.events/);
  assert.match(app, /const calendarEvents = monthPosts\.map\(postAsEvent\)/);
  assert.match(app, /initializeLegacyWorkspace\(/);
  assert.doesNotMatch(app, /isFreshWorkspace \?/);
});
