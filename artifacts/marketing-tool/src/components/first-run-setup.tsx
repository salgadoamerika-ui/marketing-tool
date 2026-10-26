import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { type FirstRunSetupInput, validateFirstRun } from '../lib/first-run';
import './first-run-setup.css';

type Props = {
  platformOptions: string[];
  contentTypes: string[];
  today: string;
  onComplete(input: FirstRunSetupInput): string | undefined;
  onSkip(): string | undefined;
  onEnterCalendar(): void;
};

const stepTitles = ['What are you promoting?', 'Where will you share it?', 'Plan your first post'];

export function FirstRunSetup({ platformOptions, contentTypes, today, onComplete, onSkip, onEnterCalendar }: Props) {
  const [step, setStep] = useState(0);
  const [serviceName, setServiceName] = useState('');
  const [mode, setMode] = useState<'evergreen' | 'campaign'>('evergreen');
  const [deadline, setDeadline] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [contentType, setContentType] = useState(contentTypes[0] ?? '');
  const [date, setDate] = useState(today);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState('');
  const [building, setBuilding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const input = (): FirstRunSetupInput => ({
    serviceName: serviceName.trim(), mode, deadline: mode === 'campaign' ? deadline : '',
    platforms, contentType, date, isCompleted,
  });

  const validateStep = (): string | undefined => {
    if (step === 0) {
      if (!serviceName.trim()) return 'Name the service or project you want to promote.';
      if (mode === 'campaign' && (!deadline || deadline < today)) return 'Choose a Campaign deadline that is today or later.';
    }
    if (step === 1 && platforms.length === 0) return 'Choose at least one platform.';
    return undefined;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (building) return;
    const stepError = validateStep();
    if (stepError) { setError(stepError); return; }
    if (step < 2) { setError(''); setStep(step + 1); return; }
    const value = input();
    const full = validateFirstRun(value, platformOptions, contentTypes, today);
    if (full) { setError(full); return; }
    const result = onComplete(value);
    if (result) { setError(result); return; }
    setError('');
    setBuilding(true);
    timer.current = window.setTimeout(() => onEnterCalendar(), 850);
  };

  const skip = () => {
    if (building) return;
    const result = onSkip();
    if (result) setError(result);
  };

  const toggle = (p: string) => {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
    setError('');
  };

  if (building) {
    return (
      <section className="frs frs-building" role="status" aria-live="polite" data-testid="status-building-plan">
        <div className="frs-pulse" aria-hidden="true" />
        <h2 className="frs-title">Building your plan…</h2>
        <p className="frs-help">Adding your first post and a few starting suggestions to the calendar.</p>
      </section>
    );
  }

  return (
    <section className="frs" aria-labelledby={`${id}-title`}>
      <header className="frs-head">
        <p className="frs-step" data-testid="text-step-progress">Step {step + 1} of 3</p>
        <button type="button" className="frs-skip" onClick={skip} data-testid="button-skip-setup">Skip setup</button>
      </header>
      <div className="frs-bar" aria-hidden="true">
        {[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}
      </div>
      <h2 id={`${id}-title`} className="frs-title" ref={headingRef} tabIndex={-1}>{stepTitles[step]}</h2>

      <form onSubmit={submit} noValidate className="frs-form">
        {step === 0 && (
          <div className="frs-fields" key="s1">
            <label className="frs-label" htmlFor={`${id}-name`}>Service or project name</label>
            <input id={`${id}-name`} className="frs-input" value={serviceName} autoComplete="off"
              placeholder="e.g. Saturday pottery class" data-testid="input-service-name"
              onChange={(e) => { setServiceName(e.target.value); setError(''); }} />
            <p className="frs-help">This name also names your starting business workspace. You can add more businesses later.</p>
            <fieldset className="frs-choice">
              <legend className="frs-label">Is it ongoing or time-bound?</legend>
              <label className={mode === 'evergreen' ? 'sel' : ''}>
                <input type="radio" name="mode" checked={mode === 'evergreen'} data-testid="radio-mode-service"
                  onChange={() => { setMode('evergreen'); setError(''); }} />
                <span><strong>Service</strong><small>Something you offer all year.</small></span>
              </label>
              <label className={mode === 'campaign' ? 'sel' : ''}>
                <input type="radio" name="mode" checked={mode === 'campaign'} data-testid="radio-mode-campaign"
                  onChange={() => { setMode('campaign'); setError(''); }} />
                <span><strong>Campaign</strong><small>A launch, sale or event with an end date.</small></span>
              </label>
            </fieldset>
            {mode === 'campaign' && (
              <>
                <label className="frs-label" htmlFor={`${id}-deadline`}>Campaign deadline</label>
                <input id={`${id}-deadline`} type="date" className="frs-input" min={today} value={deadline}
                  required data-testid="input-deadline" onChange={(e) => { setDeadline(e.target.value); setError(''); }} />
              </>
            )}
          </div>
        )}

        {step === 1 && (
          <fieldset className="frs-fields frs-platforms" key="s2">
            <legend className="frs-label">Choose one or more platforms</legend>
            <div className="frs-chips">
              {platformOptions.map((p) => (
                <label key={p} className={platforms.includes(p) ? 'sel' : ''}>
                  <input type="checkbox" checked={platforms.includes(p)} onChange={() => toggle(p)}
                    data-testid={`checkbox-platform-${p}`} />
                  <span>{platforms.includes(p) && <Check size={14} aria-hidden="true" />}{p}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div className="frs-fields" key="s3">
            <label className="frs-label" htmlFor={`${id}-type`}>Content type</label>
            <select id={`${id}-type`} className="frs-input" value={contentType} data-testid="select-content-type"
              onChange={(e) => { setContentType(e.target.value); setError(''); }}>
              {contentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="frs-label" htmlFor={`${id}-date`}>Day</label>
            <input id={`${id}-date`} type="date" className="frs-input" value={date} data-testid="input-post-date"
              max={mode === 'campaign' ? deadline : undefined}
              onChange={(e) => { setDate(e.target.value); setError(''); }} />
            <label className="frs-check">
              <input type="checkbox" checked={isCompleted} data-testid="checkbox-already-posted"
                onChange={(e) => setIsCompleted(e.target.checked)} />
              <span>Already posted <small>Mark it done so it counts toward what works.</small></span>
            </label>
            <p className="frs-help">Build my plan adds this first post to your calendar along with a few starting suggestions.</p>
          </div>
        )}

        {error && <p className="frs-error" role="alert" data-testid="text-setup-error">{error}</p>}

        <div className="frs-actions">
          {step > 0 ? (
            <button type="button" className="frs-btn ghost" onClick={() => { setError(''); setStep(step - 1); }}
              data-testid="button-back"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
          ) : <span />}
          <button type="submit" className="frs-btn primary" data-testid={step < 2 ? 'button-next' : 'button-build-plan'}>
            {step < 2 ? <>Next <ArrowRight size={16} aria-hidden="true" /></> : 'Build my plan'}
          </button>
        </div>
      </form>
    </section>
  );
}
