import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentDateInput } from '../src/lib/current-date.ts';

test('a new post defaults to the live local date, including after midnight in an already-open app', (t) => {
  const beforeMidnight = new Date(2031, 6, 14, 23, 59, 59).getTime();
  t.mock.timers.enable({ apis: ['Date'], now: beforeMidnight });
  assert.equal(currentDateInput(), '2031-07-14');
  t.mock.timers.setTime(beforeMidnight + 2000);
  assert.equal(currentDateInput(), '2031-07-15');
});

test('defaults follow year rollover and return a valid native date-input value', (t) => {
  const beforeNewYear = new Date(2032, 11, 31, 23, 59, 59).getTime();
  t.mock.timers.enable({ apis: ['Date'], now: beforeNewYear });
  assert.equal(currentDateInput(), '2032-12-31');
  t.mock.timers.setTime(beforeNewYear + 2000);
  assert.equal(currentDateInput(), '2033-01-01');
});

test('date inputs use local calendar components rather than UTC conversion', () => {
  const localDate = new Date(2034, 0, 2, 0, 5);
  assert.equal(currentDateInput(localDate), '2034-01-02');
  assert.equal(currentDateInput(new Date(2034, 10, 9, 12)), '2034-11-09');
});
