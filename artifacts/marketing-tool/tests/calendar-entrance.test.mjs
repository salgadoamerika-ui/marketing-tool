import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarRippleDelay,
  calendarRippleDurationMs,
  calendarRippleFinishMs,
  calendarRippleMaxDelayMs,
  calendarRippleStaggerMs,
} from '../src/lib/calendar-entrance.ts';

test('calendar order gets a gentle 55ms stagger, starting without a delay', () => {
  assert.deepEqual([0, 1, 2, 3].map(calendarRippleDelay), [0, 55, 110, 165]);
  assert.ok(calendarRippleStaggerMs >= 40 && calendarRippleStaggerMs <= 70);
});

test('a very full month has bounded waiting time instead of a tedious entrance', () => {
  assert.equal(calendarRippleDelay(200), calendarRippleMaxDelayMs);
  assert.equal(calendarRippleDelay(-1), 0);
});

test('cleanup waits until the final post has finished, including its stagger', () => {
  assert.equal(calendarRippleFinishMs(0), 0);
  assert.equal(calendarRippleFinishMs(1), calendarRippleDurationMs + 50);
  assert.equal(calendarRippleFinishMs(4), 165 + calendarRippleDurationMs + 50);
  assert.equal(calendarRippleFinishMs(200), calendarRippleMaxDelayMs + calendarRippleDurationMs + 50);
});
