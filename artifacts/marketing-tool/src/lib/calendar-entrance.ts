export const calendarRippleDurationMs = 950;
export const calendarRippleStaggerMs = 55;
// A very full month should not leave its last posts hidden for many seconds.
export const calendarRippleMaxDelayMs = 2200;

export function calendarRippleDelay(index: number): number {
  return Math.min(Math.max(0, index) * calendarRippleStaggerMs, calendarRippleMaxDelayMs);
}

export function calendarRippleFinishMs(postCount: number): number {
  return postCount > 0
    ? calendarRippleDelay(postCount - 1) + calendarRippleDurationMs + 50
    : 0;
}
