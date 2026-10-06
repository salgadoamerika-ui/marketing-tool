import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createBusinessContentSettings,
  defaultContentTypes,
  defaultPlatformOptions,
  deleteContentTypeAliases,
  loadBusinessContentSettings,
  renameContentTypeAliases,
  resolveSeededContentType,
} from '../src/lib/business-content-settings.ts';

const businesses = [
  { id: 'mosaic', platforms: ['Instagram'] },
  { id: 'northline', platforms: ['Facebook'] },
];

test('each business receives an independent editable catalog while legacy platforms migrate', () => {
  const migrated = loadBusinessContentSettings(null, businesses, [
    ...defaultPlatformOptions,
    'LinkedIn',
  ]);
  assert.deepEqual(migrated.mosaic.contentTypes, defaultContentTypes);
  assert.deepEqual(migrated.mosaic.platformOptions, [...defaultPlatformOptions, 'LinkedIn']);
  assert.deepEqual(migrated.mosaic.selectedPlatforms, ['Instagram']);
  assert.deepEqual(migrated.northline.selectedPlatforms, ['Facebook']);

  const mosaicEdited = {
    ...migrated.mosaic,
    contentTypes: migrated.mosaic.contentTypes.filter((type) => type !== 'Announcement'),
    platformOptions: migrated.mosaic.platformOptions.filter((platform) => platform !== 'LinkedIn'),
  };
  const reloaded = loadBusinessContentSettings(JSON.stringify({
    mosaic: mosaicEdited,
    northline: migrated.northline,
  }), businesses, [...defaultPlatformOptions, 'LinkedIn']);

  assert.equal(reloaded.mosaic.contentTypes.includes('Announcement'), false);
  assert.equal(reloaded.mosaic.platformOptions.includes('LinkedIn'), false);
  assert.ok(reloaded.northline.contentTypes.includes('Announcement'));
  assert.ok(reloaded.northline.platformOptions.includes('LinkedIn'));
});

test('new businesses start with defaults and can retain an empty catalog after deletion', () => {
  const fresh = createBusinessContentSettings(['TikTok']);
  assert.deepEqual(fresh.contentTypes, defaultContentTypes);
  assert.deepEqual(fresh.platformOptions, defaultPlatformOptions);
  assert.deepEqual(fresh.selectedPlatforms, ['TikTok']);

  const empty = {
    contentTypes: [],
    platformOptions: [],
    selectedPlatforms: [],
    contentTypeAliases: { Announcement: null },
  };
  const restored = loadBusinessContentSettings(JSON.stringify({ mosaic: empty }), [businesses[0]]);
  assert.deepEqual(restored.mosaic, empty);
  assert.equal(resolveSeededContentType('Announcement', restored.mosaic), '');
});

test('seeded calendar labels follow a rename and disappear when deleted', () => {
  const original = createBusinessContentSettings();
  const renamed = {
    ...original,
    contentTypes: original.contentTypes.map((type) => type === 'Announcement' ? 'Launch note' : type),
    contentTypeAliases: renameContentTypeAliases({}, 'Announcement', 'Launch note'),
  };
  assert.equal(resolveSeededContentType('Announcement', renamed), 'Launch note');
  assert.equal(resolveSeededContentType('Insight', renamed), 'Insight');
  assert.equal(resolveSeededContentType('Closing note', renamed), null);

  const deleted = {
    ...renamed,
    contentTypes: renamed.contentTypes.filter((type) => type !== 'Launch note'),
    contentTypeAliases: deleteContentTypeAliases(renamed.contentTypeAliases, 'Launch note'),
  };
  assert.equal(resolveSeededContentType('Announcement', deleted), '');
});

test('saved business settings reject duplicates and malformed catalogs instead of restoring deleted items', () => {
  assert.throws(() => loadBusinessContentSettings(JSON.stringify({
    mosaic: { ...createBusinessContentSettings(), contentTypes: ['Proof', 'proof'] },
  }), [businesses[0]]), /duplicate names/i);
  assert.throws(() => loadBusinessContentSettings(JSON.stringify({
    mosaic: { ...createBusinessContentSettings(), platformOptions: null },
  }), [businesses[0]]), /list of named items/i);
});
