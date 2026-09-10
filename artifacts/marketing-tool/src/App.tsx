import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Activity, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type EventTone = 'rose' | 'lavender' | 'sage' | 'sand' | 'blue' | 'blush' | 'muted';

type CalendarEvent = {
  day: number;
  title: string;
  detail?: string;
  tone: EventTone;
};

type Business = {
  id: string;
  name: string;
  descriptor: string;
  focus: string;
  palette: Array<{ label: string; tone: EventTone }>;
  events: Record<string, CalendarEvent[]>;
};

const businessData: Business[] = [
  {
    id: 'mosaic',
    name: 'Mosaic Legal',
    descriptor: 'One calm view for every service line.',
    focus: 'Fall programs are carrying the month, with evergreen services kept warm.',
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 4, title: 'Tax planning: common filing errors', detail: 'Post', tone: 'sand' },
        { day: 8, title: 'Immigration: document checklist', detail: 'Inside look', tone: 'blue' },
        { day: 13, title: 'Fall programs: save the date', detail: 'Announcement', tone: 'rose' },
        { day: 18, title: 'Divorce: first conversation', detail: 'Insight', tone: 'lavender' },
        { day: 25, title: 'Insurance review: what changed?', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 2, title: 'Fall programs open', detail: 'Announcement', tone: 'rose' },
        { day: 4, title: 'Tax planning for a new quarter', detail: 'Insight', tone: 'sand' },
        { day: 7, title: 'Divorce: the first practical step', detail: 'Inside look', tone: 'lavender' },
        { day: 9, title: 'Meet the fall team', detail: 'Inside look', tone: 'rose' },
        { day: 11, title: 'Immigration: what to bring', detail: 'Insight', tone: 'blue' },
        { day: 14, title: 'Insurance review week', detail: 'Book now', tone: 'sage' },
        { day: 16, title: 'Fall programs: early places', detail: 'Proof', tone: 'blush' },
        { day: 18, title: 'Tax planning: a cleaner close', detail: 'Book now', tone: 'sand' },
        { day: 21, title: 'Divorce consults, explained', detail: 'Announcement', tone: 'lavender' },
        { day: 23, title: 'Fall programs: behind the scenes', detail: 'Inside look', tone: 'rose' },
        { day: 25, title: 'Immigration clinic', detail: 'Book now', tone: 'blue' },
        { day: 28, title: 'Insurance questions answered', detail: 'Recap', tone: 'sage' },
        { day: 30, title: 'Fall programs: last places', detail: 'Closing note', tone: 'blush' },
      ],
      '2026-10': [
        { day: 2, title: 'Fall programs: final call', detail: 'Announcement', tone: 'rose' },
        { day: 6, title: 'Insurance renewal checklist', detail: 'Insight', tone: 'sage' },
        { day: 10, title: 'Divorce: what happens next', detail: 'Inside look', tone: 'lavender' },
        { day: 15, title: 'Tax planning before year-end', detail: 'Book now', tone: 'sand' },
        { day: 22, title: 'Immigration Q&A', detail: 'Insight', tone: 'blue' },
        { day: 29, title: 'October service recap', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
  {
    id: 'northline',
    name: 'Northline Financial',
    descriptor: 'Keep the useful work in motion.',
    focus: 'Year-end planning is moving forward while the weekly rhythm stays visible.',
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 6, title: 'Quarterly planning notes', detail: 'Insight', tone: 'sand' },
        { day: 12, title: 'Fall programs: early places', detail: 'Proof', tone: 'rose' },
        { day: 20, title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 3, title: 'Fall programs: planning ahead', detail: 'Announcement', tone: 'rose' },
        { day: 8, title: 'Tax planning for the final quarter', detail: 'Insight', tone: 'sand' },
        { day: 12, title: 'What an insurance review covers', detail: 'Inside look', tone: 'sage' },
        { day: 17, title: 'Year-end decisions, made simple', detail: 'Book now', tone: 'sand' },
        { day: 24, title: 'Immigration: the timeline view', detail: 'Inside look', tone: 'blue' },
      ],
      '2026-10': [
        { day: 3, title: 'Year-end planning begins', detail: 'Announcement', tone: 'sand' },
        { day: 14, title: 'Insurance renewal questions', detail: 'Insight', tone: 'sage' },
        { day: 24, title: 'Tax planning: final spots', detail: 'Book now', tone: 'sand' },
      ],
    },
  },
  {
    id: 'harbor',
    name: 'Harbor Coverage',
    descriptor: 'A steadier rhythm for the people you serve.',
    focus: 'Insurance leads the calendar, with a few useful cross-service reminders alongside it.',
    palette: [
      { label: 'Fall programs', tone: 'rose' },
      { label: 'Tax planning', tone: 'sand' },
      { label: 'Divorce', tone: 'lavender' },
      { label: 'Immigration', tone: 'blue' },
      { label: 'Insurance', tone: 'sage' },
    ],
    events: {
      '2026-08': [
        { day: 5, title: 'Insurance review: a reset', detail: 'Announcement', tone: 'sage' },
        { day: 19, title: 'The coverage check-in', detail: 'Book now', tone: 'sage' },
      ],
      '2026-09': [
        { day: 1, title: 'Insurance review week', detail: 'Announcement', tone: 'sage' },
        { day: 6, title: 'Three questions to ask now', detail: 'Insight', tone: 'sage' },
        { day: 15, title: 'Tax planning: the early look', detail: 'Inside look', tone: 'sand' },
        { day: 20, title: 'Coverage stories from the field', detail: 'Proof', tone: 'blush' },
        { day: 26, title: 'Immigration support, explained', detail: 'Insight', tone: 'blue' },
      ],
      '2026-10': [
        { day: 7, title: 'Renewal season, without the rush', detail: 'Inside look', tone: 'sage' },
        { day: 16, title: 'Insurance review office hours', detail: 'Book now', tone: 'sage' },
        { day: 27, title: 'October questions, answered', detail: 'Recap', tone: 'muted' },
      ],
    },
  },
];

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function makeCalendarDays(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(date.getFullYear(), date.getMonth(), 1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function CalendarSurface() {
  const [activeBusinessId, setActiveBusinessId] = useState('mosaic');
  const [visibleMonth, setVisibleMonth] = useState(new Date(2026, 8, 1));
  const [statusMessage, setStatusMessage] = useState('');

  const activeBusiness = businessData.find((business) => business.id === activeBusinessId) ?? businessData[0];
  const days = useMemo(() => makeCalendarDays(visibleMonth), [visibleMonth]);
  const events = activeBusiness.events[monthKey(visibleMonth)] ?? [];
  const todayKey = '2026-09-10';

  const shiftMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setStatusMessage('');
  };

  const showActionMessage = (message: string) => {
    setStatusMessage(message);
    window.setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <main className="calendar-page">
      <div className="calendar-shell">
        <nav className="business-tabs" aria-label="Businesses">
          {businessData.map((business) => (
            <button
              className={`business-tab ${business.id === activeBusiness.id ? 'active' : ''}`}
              key={business.id}
              onClick={() => {
                setActiveBusinessId(business.id);
                setStatusMessage('');
              }}
              type="button"
            >
              <span className="business-dot" aria-hidden="true" />
              {business.name}
            </button>
          ))}
          <button
            aria-label="Add a business"
            className="business-tab business-tab-add"
            onClick={() => showActionMessage('Business workspaces will stay separate as this calendar grows.')}
            type="button"
          >
            <Plus size={17} strokeWidth={1.7} />
          </button>
        </nav>

        <header className="calendar-header">
          <div>
            <p className="calendar-kicker">Monthly workspace</p>
            <h1 className="calendar-title">
              {monthFormatter.format(visibleMonth).split(' ')[0]} <em>{visibleMonth.getFullYear()}</em>
            </h1>
            <p className="calendar-subtitle">{activeBusiness.descriptor} {activeBusiness.focus}</p>
          </div>
          <div className="header-actions">
            <div className="month-nav" aria-label="Change month">
              <button aria-label="Previous month" className="icon-button" onClick={() => shiftMonth(-1)} type="button">
                <ChevronLeft size={18} strokeWidth={1.7} />
              </button>
              <span className="month-nav-label">{monthFormatter.format(visibleMonth)}</span>
              <button aria-label="Next month" className="icon-button" onClick={() => shiftMonth(1)} type="button">
                <ChevronRight size={18} strokeWidth={1.7} />
              </button>
            </div>
            <button className="add-post" onClick={() => showActionMessage('The calendar is ready for your next post.') } type="button">
              <Plus size={15} strokeWidth={2.2} />
              Add post
            </button>
          </div>
        </header>

        <div className="calendar-toolbar">
          <p className="toolbar-note">
            <strong>{events.length} planned moments</strong> · {activeBusiness.name}
          </p>
          <div className="view-toggle" aria-label="Calendar view">
            <button className="view-option active" type="button">Month</button>
            <button
              className="view-option"
              disabled
              onClick={() => showActionMessage('Week view is coming after the monthly workspace.')}
              type="button"
            >
              Week
            </button>
          </div>
        </div>

        <div className="content-layout">
          <section aria-label={`${monthFormatter.format(visibleMonth)} content calendar`} className="calendar-card">
            <div className="days-header">
              {dayNames.map((dayName) => <span key={dayName}>{dayName.slice(0, 3)}</span>)}
            </div>
            <div className="calendar-grid">
              {days.map((day) => {
                const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}`;
                const dayEvents = dateKey === monthKey(visibleMonth)
                  ? events.filter((event) => event.day === day.getDate())
                  : [];
                const isOutside = day.getMonth() !== visibleMonth.getMonth();
                const isToday = `${dateKey}-${String(day.getDate()).padStart(2, '0')}` === todayKey;

                return (
                  <div className={`day-cell ${isOutside ? 'outside' : ''}`} key={day.toISOString()}>
                    <span className={`day-number ${isOutside ? 'outside' : ''} ${isToday ? 'today' : ''}`}>
                      {day.getDate()}
                    </span>
                    <div className="day-events">
                      {dayEvents.map((event) => (
                        <div className={`event-chip event-${event.tone}`} key={`${event.day}-${event.title}`}>
                          {event.title}
                          {event.detail && <small>{event.detail}</small>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="sidebar">
            <section className="insight-card tint">
              <p className="insight-eyebrow">This month at a glance</p>
              <h2>Keep the signal warm.</h2>
              <p>{activeBusiness.focus}</p>
              <div className="focus-list">
                {activeBusiness.palette.map((item) => (
                  <div className="focus-row" key={item.label}>
                    <span className={`focus-dot ${item.tone}`} />
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="heartbeat">
                <span className="heartbeat-mark"><Activity size={14} strokeWidth={1.8} /></span>
                <div>
                  <strong>Weekly heartbeat</strong>
                  <span>One check-in keeps every service moving.</span>
                </div>
              </div>
            </section>

            <section className="insight-card">
              <p className="legend-title">Content threads</p>
              <div className="legend">
                {activeBusiness.palette.map((item) => (
                  <div className="legend-item" key={item.label}>
                    <span className={`legend-swatch event-${item.tone}`} />
                    {item.label}
                  </div>
                ))}
              </div>
              {statusMessage && <p className="calendar-status" role="status">{statusMessage}</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={CalendarSurface} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;