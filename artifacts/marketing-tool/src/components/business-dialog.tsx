import { type CSSProperties, type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, X } from 'lucide-react';
import { businessAccentOptions, type BusinessAccent } from '../lib/business-accents';
import { modeLabel, type ServiceDefinition, type ServiceMode } from '../lib/services';

function todayForInput() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export type BusinessSetupInput = {
  name: string;
  accent: BusinessAccent;
  serviceName: string;
  mode: ServiceMode;
  startDate: string;
  deadline: string;
  platforms: string[];
};

export type CreatedBusinessSummary = {
  id: string;
  name: string;
  accent: BusinessAccent;
  service: ServiceDefinition;
  platforms: string[];
};

export type BusinessSetupResult =
  | { business: CreatedBusinessSummary; error?: never }
  | { error: string; business?: never };

export function BusinessDialog({
  platformOptions,
  onCreate,
  onOpenBusiness,
  onClose,
}: {
  platformOptions: string[];
  onCreate: (input: BusinessSetupInput) => BusinessSetupResult;
  onOpenBusiness: (businessId: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [accent, setAccent] = useState<BusinessAccent>('rose');
  const [serviceName, setServiceName] = useState('');
  const [mode, setMode] = useState<ServiceMode>('evergreen');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(platformOptions);
  const [error, setError] = useState('');
  const [createdBusiness, setCreatedBusiness] = useState<CreatedBusinessSummary | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const choiceGroupId = useId();

  useEffect(() => {
    if (createdBusiness) continueRef.current?.focus();
    else nameRef.current?.focus();
  }, [createdBusiness]);

  const dismiss = () => {
    if (createdBusiness) onOpenBusiness(createdBusiness.id);
    else onClose();
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
    setError('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanServiceName = serviceName.trim();
    if (!cleanName) {
      setError('Enter a name for this business.');
      return;
    }
    if (!cleanServiceName) {
      setError('Enter a name for its first Service or Campaign.');
      return;
    }
    if (platforms.length === 0) {
      setError('Choose at least one platform.');
      return;
    }
    if (mode === 'campaign' && (!startDate || !deadline || startDate > deadline)) {
      setError('Choose a valid start date and deadline for this Campaign.');
      return;
    }

    const result = onCreate({
      name: cleanName,
      accent,
      serviceName: cleanServiceName,
      mode,
      startDate,
      deadline,
      platforms,
    });
    if (!result.business) {
      setError(result.error || 'The business could not be created.');
      return;
    }
    setError('');
    setCreatedBusiness(result.business);
  };

  return (
    <div
      className="post-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="post-modal business-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            dismiss();
          }
        }}
        role="dialog"
      >
        <div className="post-modal-header">
          <div>
            <p className="post-modal-kicker">{createdBusiness ? 'Workspace set up' : 'Step 1 of 2 · Separate workspace'}</p>
            <h2 id={titleId}>{createdBusiness ? `${createdBusiness.name} is ready` : 'Add a business'}</h2>
            <p className="post-modal-intro">{createdBusiness
              ? 'Your new workspace is set up and ready for its first posts.'
              : 'Set up the business, its first Service or Campaign, and the platforms it uses.'}</p>
          </div>
          <button aria-label={createdBusiness ? 'Open the new business' : 'Close add business form'} className="modal-close" onClick={dismiss} type="button">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {createdBusiness ? (
          <div className="business-confirmation">
            <div className="business-created-service">
              <span className="business-created-swatch" style={{ backgroundColor: businessAccentOptions.find((option) => option.value === createdBusiness.accent)?.color }} />
              <div>
                <strong>{createdBusiness.service.name}</strong>
                <span>
                  {modeLabel(createdBusiness.service.mode)}
                  {createdBusiness.service.mode === 'campaign'
                    ? ` · deadline ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${createdBusiness.service.endDate}T12:00:00`))}`
                    : ' · ongoing'}
                </span>
              </div>
              <span className="business-created-platforms">{createdBusiness.platforms.join(' · ')}</span>
            </div>
            <ul className="business-benefits">
              <li><span><Check size={14} strokeWidth={2.4} /></span><span>Its own calendar and business tab</span></li>
              <li><span><Check size={14} strokeWidth={2.4} /></span><span>Its own airtime balance across its services</span></li>
              <li><span><Check size={14} strokeWidth={2.4} /></span><span>An independent posting rhythm and check-in</span></li>
              <li><span><Check size={14} strokeWidth={2.4} /></span><span>Separate performance tracking, learning, and suggestions</span></li>
            </ul>
            <p className="business-separation-note">Everything stays separate from your other businesses.</p>
            <div className="post-form-actions">
              <button
                className="save-post-button business-open-button"
                onClick={() => onOpenBusiness(createdBusiness.id)}
                ref={continueRef}
                type="button"
              >
                Open {createdBusiness.name}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form className="post-form business-setup-form" noValidate onSubmit={submit}>
            <label className="form-field" htmlFor="business-name">
              <span>Business name <b>*</b></span>
              <input
                aria-invalid={Boolean(error)}
                autoComplete="organization"
                id="business-name"
                maxLength={80}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                placeholder="e.g. Northside Studio"
                ref={nameRef}
                required
                type="text"
                value={name}
              />
            </label>

            <fieldset className="business-accent-fieldset">
              <legend>Choose a tab accent</legend>
              <div className="business-accent-options">
                {businessAccentOptions.map((option) => (
                  <label
                    className={`business-accent-option ${accent === option.value ? 'selected' : ''}`}
                    htmlFor={`business-accent-${option.value}`}
                    key={option.value}
                    style={{ '--business-accent': option.color } as CSSProperties}
                  >
                    <input
                      checked={accent === option.value}
                      id={`business-accent-${option.value}`}
                      name={`${choiceGroupId}-accent`}
                      onChange={() => {
                        setAccent(option.value);
                        setError('');
                      }}
                      type="radio"
                      value={option.value}
                    />
                    <span className="business-accent-swatch" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="form-field" htmlFor="business-service-name">
              <span>First Service or Campaign <b>*</b></span>
              <input
                aria-invalid={Boolean(error)}
                id="business-service-name"
                maxLength={80}
                onChange={(event) => {
                  setServiceName(event.target.value);
                  setError('');
                }}
                placeholder="e.g. Spring enrollment"
                required
                type="text"
                value={serviceName}
              />
            </label>

            <fieldset className="business-mode-fieldset">
              <legend>What kind of work is this?</legend>
              <div className="business-mode-options">
                <label className={`business-mode-option ${mode === 'evergreen' ? 'selected' : ''}`}>
                  <input
                    checked={mode === 'evergreen'}
                    name={`${choiceGroupId}-mode`}
                    onChange={() => {
                      setMode('evergreen');
                      setError('');
                    }}
                    type="radio"
                    value="evergreen"
                  />
                  <span><strong>Service</strong><small>Ongoing work without an end date.</small></span>
                </label>
                <label className={`business-mode-option ${mode === 'campaign' ? 'selected' : ''}`}>
                  <input
                    checked={mode === 'campaign'}
                    name={`${choiceGroupId}-mode`}
                    onChange={() => {
                      setMode('campaign');
                      setStartDate((current) => current || todayForInput());
                      setError('');
                    }}
                    type="radio"
                    value="campaign"
                  />
                  <span><strong>Campaign</strong><small>A focused push with a real deadline.</small></span>
                </label>
              </div>
            </fieldset>

            {mode === 'campaign' && (
              <div className="business-campaign-dates">
                <label className="form-field" htmlFor="business-campaign-start">
                  <span>Start date <b>*</b></span>
                  <input
                    id="business-campaign-start"
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setError('');
                    }}
                    required
                    type="date"
                    value={startDate}
                  />
                </label>
                <label className="form-field" htmlFor="business-campaign-deadline">
                  <span>Deadline <b>*</b></span>
                  <input
                    id="business-campaign-deadline"
                    min={startDate || undefined}
                    onChange={(event) => {
                      setDeadline(event.target.value);
                      setError('');
                    }}
                    required
                    type="date"
                    value={deadline}
                  />
                </label>
              </div>
            )}

            <fieldset className="business-platform-fieldset">
              <legend>Platforms they post on <b>*</b></legend>
              <div className="business-platform-options">
                {platformOptions.map((platform, index) => {
                  const id = `business-platform-${index}`;
                  const selected = platforms.includes(platform);
                  return (
                    <label className={`platform-option business-platform-option ${selected ? 'selected' : ''}`} htmlFor={id} key={platform}>
                      <input
                        checked={selected}
                        id={id}
                        onChange={() => togglePlatform(platform)}
                        type="checkbox"
                      />
                      <span className="platform-check">{selected && <Check size={13} strokeWidth={2.2} />}</span>
                      {platform}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="post-form-actions">
              <button className="cancel-button" onClick={onClose} type="button">Cancel</button>
              <button className="save-post-button" type="submit">Create business</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
