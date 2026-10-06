import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { type ServiceDefinition, modeLabel } from '../lib/services';
import './service-manager.css';

type ServiceManagerProps = {
  services: ServiceDefinition[];
  businessId: string;
  businessName: string;
  platformOptions: string[];
  defaultPlatforms: string[];
  onSave: (service: ServiceDefinition) => string | ServiceDefinition;
  onClose: () => void;
};

type Draft = {
  id: string;
  businessId: string;
  name: string;
  mode: ServiceDefinition['mode'];
  startDate: string;
  endDate: string;
  platforms: string[];
  isNew: boolean;
};

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function describe(service: ServiceDefinition) {
  return service.mode === 'campaign'
    ? `${modeLabel(service.mode)} · ${formatDate(service.startDate)} to ${formatDate(service.endDate)}`
    : modeLabel(service.mode);
}

export function ServiceManager({
  services,
  businessId,
  businessName,
  platformOptions,
  defaultPlatforms,
  onSave,
  onClose,
}: ServiceManagerProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdService, setCreatedService] = useState<ServiceDefinition | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const pressStartedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();
  const uid = useId();

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => restoreRef.current?.focus?.();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const startEdit = (service: ServiceDefinition) => {
    setDraft({
      id: service.id,
      businessId: service.businessId,
      name: service.name,
      mode: service.mode,
      startDate: service.mode === 'campaign' ? service.startDate : '',
      endDate: service.mode === 'campaign' ? service.endDate : '',
      platforms: [...(service.platforms ?? defaultPlatforms)],
      isNew: false,
    });
    setError('');
    setSuccess('');
    setCreatedService(null);
  };

  const startAdd = () => {
    setDraft({
      id: crypto.randomUUID(),
      businessId,
      name: '',
      mode: 'evergreen',
      startDate: '',
      endDate: '',
      platforms: defaultPlatforms.filter((platform) => platformOptions.includes(platform)),
      isNew: true,
    });
    setError('');
    setSuccess('');
    setCreatedService(null);
  };

  const patch = (changes: Partial<Draft>) => {
    setDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      if (changes.mode === 'campaign' && !next.startDate) next.startDate = localToday();
      return next;
    });
    setError('');
  };

  const cancel = () => { setDraft(null); setError(''); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError('Enter a name for this service.'); return; }
    if (draft.platforms.length === 0) { setError('Choose at least one platform.'); return; }
    let service: ServiceDefinition;
    if (draft.mode === 'campaign') {
      if (!draft.startDate || !draft.endDate) { setError('Choose both a start date and a deadline.'); return; }
      if (draft.startDate > draft.endDate) { setError('The deadline must be on or after the start date.'); return; }
      service = {
        id: draft.id,
        businessId: draft.businessId,
        name,
        mode: 'campaign',
        startDate: draft.startDate,
        endDate: draft.endDate,
        platforms: draft.platforms,
      };
    } else {
      service = { id: draft.id, businessId: draft.businessId, name, mode: 'evergreen', platforms: draft.platforms };
    }
    const result = onSave(service);
    if (typeof result === 'string') { setError(result); return; }
    if (draft.isNew) {
      setCreatedService(result);
      setSuccess('');
    } else {
      setSuccess(`Saved ${name} as a ${modeLabel(service.mode)}.`);
    }
    setDraft(null);
    setError('');
  };

  return (
    <div
      className="sm-backdrop"
      onMouseDown={(e) => { pressStartedOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose();
        pressStartedOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="sm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
      >
        <header className="sm-header">
          <div>
            <p className="sm-kicker">{businessName}</p>
            <h2 className="sm-title" id={titleId}>Manage services</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close service manager" onClick={onClose} data-autofocus>
            <X size={17} strokeWidth={1.8} />
          </button>
        </header>
        <div className="sm-body">
          <div className="sm-live" role="status" aria-live="polite">
            {success && <p className="sm-success">{success}</p>}
            {createdService && (
              <section className="sm-confirmation" aria-label={`${createdService.name} is live`}>
                <div className="sm-confirmation-heading">
                  <span className={`sm-color-dot event-${createdService.tone ?? 'muted'}`} aria-hidden="true" />
                  <div>
                    <h3>{createdService.name} is live</h3>
                    <p>
                      {createdService.mode === 'campaign'
                        ? `Campaign · deadline ${formatDate(createdService.endDate)}`
                        : 'Service · ongoing'}
                    </p>
                  </div>
                </div>
                <p className="sm-confirmation-copy">
                  It now has its own calendar color, a place in {businessName}’s airtime balance, and separate performance learning and suggestions.
                </p>
                <p className="sm-confirmation-platforms">{createdService.platforms?.join(' · ')}</p>
                <button className="sm-btn sm-btn-primary" onClick={onClose} type="button">Back to calendar</button>
              </section>
            )}
          </div>

          {services.length === 0 ? (
            <p className="sm-empty">No services yet. Add the first one below.</p>
          ) : (
            <ul className="sm-list" aria-label="Services">
              {services.map((service) => (
                <li className="sm-row" key={service.id}>
                  <div className="sm-row-main">
                      <div className="sm-row-title">
                        {service.tone && <span className={`sm-color-dot event-${service.tone}`} aria-hidden="true" />}
                        <span className="sm-row-name">{service.name}</span>
                      </div>
                    <span className="sm-row-meta">{describe(service)}</span>
                  </div>
                  <button
                    type="button"
                    className="sm-btn sm-btn-small"
                    aria-label={`Edit ${service.name}`}
                    onClick={() => startEdit(service)}
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft ? (
            <form className="sm-form" onSubmit={submit} noValidate aria-label={draft.isNew ? 'New service' : `Edit ${draft.name}`}>
              <h3>{draft.isNew ? 'New service' : draft.name}</h3>
              <label className="sm-field">
                <span>Name{draft.isNew && <b aria-hidden="true"> *</b>}</span>
                <input
                  type="text"
                  value={draft.name}
                  readOnly={!draft.isNew}
                  required={draft.isNew}
                  maxLength={80}
                  onChange={(e) => patch({ name: e.target.value })}
                  aria-invalid={Boolean(error) && draft.isNew && !draft.name.trim()}
                />
              </label>
              <fieldset className="sm-fieldset">
                <legend>Type</legend>
                <label className="sm-choice">
                  <input type="radio" name={`${uid}-mode`} value="evergreen" checked={draft.mode === 'evergreen'} onChange={() => patch({ mode: 'evergreen' })} />
                  <span>
                    <strong>Service</strong>
                    <small>Something you offer ongoing — no end date.</small>
                  </span>
                </label>
                <label className="sm-choice">
                  <input type="radio" name={`${uid}-mode`} value="campaign" checked={draft.mode === 'campaign'} onChange={() => patch({ mode: 'campaign' })} />
                  <span>
                    <strong>Campaign</strong>
                    <small>A push toward a deadline.</small>
                  </span>
                </label>
              </fieldset>
              {draft.mode === 'campaign' && (
                <div className="sm-dates">
                  <label className="sm-field">
                    <span>Start date <b aria-hidden="true">*</b></span>
                    <input type="date" required value={draft.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
                  </label>
                  <label className="sm-field">
                    <span>Deadline <b aria-hidden="true">*</b></span>
                    <input type="date" required value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => patch({ endDate: e.target.value })} />
                  </label>
                </div>
              )}
              <fieldset className="sm-fieldset sm-platform-fieldset">
                <legend>Platforms for this service <b aria-hidden="true">*</b></legend>
                <div className="platform-options">
                  {platformOptions.map((platform) => {
                    const selected = draft.platforms.includes(platform);
                    return (
                      <label className={`platform-option ${selected ? 'selected' : ''}`} key={platform}>
                        <input
                          checked={selected}
                          onChange={() => patch({
                            platforms: selected
                              ? draft.platforms.filter((item) => item !== platform)
                              : [...draft.platforms, platform],
                          })}
                          type="checkbox"
                        />
                        <span className="platform-check">{selected && <span aria-hidden="true">✓</span>}</span>
                        {platform}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <p className="sm-error" role="alert">{error}</p>
              <div className="sm-actions">
                <button type="button" className="sm-btn" onClick={cancel}>Cancel</button>
                <button type="submit" className="sm-btn sm-btn-primary">Save</button>
              </div>
            </form>
          ) : (
            <div className="sm-actions">
              <button type="button" className="sm-btn sm-btn-primary" onClick={startAdd}>Add service</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
