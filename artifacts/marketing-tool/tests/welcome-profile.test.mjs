import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWelcomeName, resolveWelcomeName } from '../src/lib/welcome-profile.ts';

test('a logged-in profile name takes priority over the stored welcome name', () => {
  assert.equal(resolveWelcomeName('  Taylor  ', 'Sam'), 'Taylor');
});

test('the stored display name is used until a logged-in profile is available', () => {
  assert.equal(resolveWelcomeName(undefined, '  Sam  '), 'Sam');
  assert.equal(resolveWelcomeName('   ', 'Sam'), 'Sam');
});

test('missing or invalid names use the editable fallback without rendering undefined', () => {
  assert.equal(resolveWelcomeName(), defaultWelcomeName);
  assert.equal(resolveWelcomeName(null, '  '), defaultWelcomeName);
  assert.equal(resolveWelcomeName({ name: 'Invalid' }, 123), defaultWelcomeName);
});
