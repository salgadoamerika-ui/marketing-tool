import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Sparkles } from "lucide-react";
import "./week-calendar-view.css";

export type WeekCalendarItem = {
  id?: string;
  date: string;
  title: string;
  project?: string;
  contentType?: string;
  platformLabel: string;
  timeLabel: string;
  colorClass: string;
  colorStyle?: CSSProperties;
  isSuggestion?: boolean;
  isCompleted?: boolean;
};

export type WeekCalendarViewProps = {
  weekStart: Date;
  items: WeekCalendarItem[];
  todayKey: string;
  onPreviousWeek(): void;
  onNextWeek(): void;
  onAddPost(date: string): void;
  onOpenPost(id: string): void;
  onToggleComplete(id: string, isCompleted: boolean): void;
  completedCount: number;
  onUploadInsights(): void;
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const monthDayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekRange(start: Date, end: Date): string {
  if (start.getFullYear() !== end.getFullYear()) {
    return `${monthDayYearFormatter.format(start)} – ${monthDayYearFormatter.format(end)}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    const startLabel = `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)}`;
    const endLabel = `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(end)}, ${end.getFullYear()}`;
    return `${startLabel} – ${endLabel}`;
  }
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(start);
  return `${month} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
}

function CalendarPost({
  item,
  index,
  onOpenPost,
  onToggleComplete,
}: {
  item: WeekCalendarItem;
  index: number;
  onOpenPost(id: string): void;
  onToggleComplete(id: string, isCompleted: boolean): void;
}) {
  const classes = [
    "week-post",
    item.colorClass,
    item.isSuggestion ? "week-post-suggestion event-chip-suggestion" : "",
    item.id ? "week-post-openable" : "",
    item.isCompleted ? "week-post-completed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const testId = `card-week-post-${item.id ?? `${item.date}-${index}`}`;

  const content = (
    <>
      <span aria-hidden="true" className="week-post-art">
        <span className="week-post-art-orbit" />
        <span className="week-post-art-line" />
        {item.isSuggestion && <span className="week-post-art-mark" />}
      </span>
      <span className="week-post-copy">
        <span className="week-post-kicker" data-testid={`text-content-type-${item.id ?? `${item.date}-${index}`}`}>
          {item.contentType || "Planned post"}
        </span>
        <span className="week-post-title">{item.project || item.title}</span>
        <span className="week-post-project">{item.title}</span>
        <span className="week-post-meta">
          <span>{item.platformLabel}</span>
          <span aria-hidden="true" className="week-post-meta-dot" />
          <span>{item.timeLabel}</span>
        </span>
      </span>
      {item.isSuggestion && (
        <span className="week-post-suggestion-note">
          <Sparkles aria-hidden="true" size={11} strokeWidth={1.8} />
          Suggested
        </span>
      )}
      {item.id && <ArrowUpRight aria-hidden="true" className="week-post-arrow" size={14} />}
    </>
  );

  if (item.id) {
    return (
      <article className={classes} data-testid={testId} style={item.colorStyle}>
        <button
          aria-label={`Open post: ${item.title}, ${item.project || "General campaign"}, ${item.platformLabel} at ${item.timeLabel}`}
          className="week-post-open-button"
          data-testid={`button-open-${testId}`}
          onClick={() => onOpenPost(item.id!)}
          type="button"
        >
          {content}
        </button>
        <label className="week-post-completion">
          <input
            aria-label={item.isCompleted ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
            checked={Boolean(item.isCompleted)}
            data-testid={`checkbox-done-${item.id}`}
            onChange={(event) => onToggleComplete(item.id!, event.target.checked)}
            type="checkbox"
          />
          <span>{item.isCompleted ? <Check aria-hidden="true" size={13} /> : null}</span>
          {item.isCompleted ? "Done" : "Mark done"}
        </label>
      </article>
    );
  }

  return (
    <article className={classes} data-testid={testId} style={item.colorStyle}>
      {content}
    </article>
  );
}

export function WeekCalendarView({
  weekStart,
  items,
  todayKey,
  onPreviousWeek,
  onNextWeek,
  onAddPost,
  onOpenPost,
  onToggleComplete,
  completedCount,
  onUploadInsights,
}: WeekCalendarViewProps) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    return { date, key: dateKey(date), weekday: weekdayFormatter.format(date) };
  });
  const weekEnd = days[6].date;
  const range = formatWeekRange(days[0].date, weekEnd);

  return (
    <section aria-label={`Weekly content calendar, week of ${range}`} className="week-calendar">
      <header className="week-calendar-toolbar">
        <div className="week-calendar-heading">
          <span className="week-calendar-eyebrow">The editorial week</span>
          <h2 data-testid="text-week-range">Week of {range}</h2>
        </div>
        <nav aria-label="Choose calendar week" className="week-calendar-nav">
          <button
            aria-label="Previous week"
            className="week-nav-button"
            data-testid="button-previous-week"
            onClick={onPreviousWeek}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={16} />
          </button>
          <span aria-live="polite" className="week-nav-current">{range}</span>
          <button
            aria-label="Next week"
            className="week-nav-button"
            data-testid="button-next-week"
            onClick={onNextWeek}
            type="button"
          >
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </nav>
      </header>

      <div className="week-calendar-scroll" data-testid="calendar-week-scroll">
        <div className="week-calendar-grid">
          <aside aria-label="Weekly check-in" className="week-checkin-column">
            <div className="week-column-heading checkin-heading">
              <span className="week-checkin-icon"><CalendarDays aria-hidden="true" size={15} /></span>
              <span className="week-day-name">Check-in</span>
              <span className="week-date-label">Weekly</span>
            </div>
            <div className="week-checkin-card" data-testid="card-week-checkin">
              <span className="week-checkin-overline">A moment to reflect</span>
              <span aria-hidden="true" className="week-checkin-rule" />
              <p>Upload last week’s insights — I’ll read what landed and tune this week around it</p>
              <p className="week-checkin-progress" aria-live="polite" data-testid="text-week-progress">
                {completedCount} of {items.length} moves done this week.
              </p>
              <button
                className="week-upload-button"
                data-testid="button-upload-insights"
                onClick={onUploadInsights}
                type="button"
              >
                Upload insights
                <ArrowUpRight aria-hidden="true" size={14} />
              </button>
              <span aria-hidden="true" className="week-checkin-stamp">01 / REFLECT</span>
            </div>
          </aside>

          {days.map(({ date, key, weekday }, dayIndex) => {
            const dayItems = items
              .map((item, itemIndex) => ({ item, itemIndex }))
              .filter(({ item }) => item.date === key);
            const isToday = key === todayKey;
            const isSunday = dayIndex === 6;

            return (
              <section
                aria-label={`${weekday}, ${monthDayYearFormatter.format(date)}`}
                className={`week-day-column${isToday ? " is-today" : ""}`}
                data-testid={`column-week-day-${key}`}
                key={key}
              >
                <div className="week-column-heading">
                  <span className="week-day-name">{weekday}</span>
                  <span className={`week-date-label${isToday ? " week-date-today" : ""}`}>
                    <span>{monthDayFormatter.format(date)}</span>
                    {isToday && <span className="week-today-indicator">Today</span>}
                  </span>
                </div>
                <div className="week-day-content">
                  {dayItems.map(({ item, itemIndex }) => (
                    <CalendarPost
                      index={itemIndex}
                      item={item}
                      key={`${item.id ?? item.title}-${itemIndex}`}
                      onOpenPost={onOpenPost}
                      onToggleComplete={onToggleComplete}
                    />
                  ))}
                  {dayItems.length === 0 && isSunday ? (
                    <p className="week-rest-day" data-testid={`text-rest-day-${key}`}>Rest day</p>
                  ) : dayItems.length === 0 ? (
                    <button
                      aria-label={`Add post for ${weekday}, ${monthDayYearFormatter.format(date)}`}
                      className="week-add-post"
                      data-testid={`button-add-post-${key}`}
                      onClick={() => onAddPost(key)}
                      type="button"
                    >
                      <span aria-hidden="true">+</span>
                      Add post
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default WeekCalendarView;
