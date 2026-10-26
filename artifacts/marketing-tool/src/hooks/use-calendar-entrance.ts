import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { calendarRippleDelay, calendarRippleFinishMs } from '@/lib/calendar-entrance';
import './calendar-entrance.css';

/**
 * Decorate only the initially mounted chips. DOM order is calendar date order
 * (left to right, then the next row); subsequent posts and rerenders are untouched.
 * The paused CSS animation keeps posts hidden while the welcome screen exits.
 */
export function useCalendarEntrance(
  calendarRef: RefObject<HTMLDivElement | null>,
  hasEntered: boolean,
) {
  const initialPosts = useRef<HTMLElement[]>([]);

  useLayoutEffect(() => {
    const posts = Array.from(
      calendarRef.current?.querySelectorAll<HTMLElement>('.calendar-grid .event-chip, .week-post') ?? [],
    );
    initialPosts.current = posts;
    posts.forEach((post, index) => {
      post.style.setProperty('--calendar-ripple-delay', `${calendarRippleDelay(index)}ms`);
      post.classList.add('calendar-post-ripple');
    });
    return () => {
      posts.forEach((post) => {
        post.classList.remove('calendar-post-ripple');
        post.style.removeProperty('--calendar-ripple-delay');
      });
    };
  }, [calendarRef]);

  useEffect(() => {
    if (!hasEntered) return;
    // Remove the animation decoration once, not per post or on data changes.
    // This also cleans up when reduced-motion disables animationend events.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      initialPosts.current.forEach((post) => {
        post.classList.remove('calendar-post-ripple');
        post.style.removeProperty('--calendar-ripple-delay');
      });
      initialPosts.current = [];
    }, reduceMotion ? 0 : calendarRippleFinishMs(initialPosts.current.length));
    return () => window.clearTimeout(timer);
  }, [hasEntered]);
}
