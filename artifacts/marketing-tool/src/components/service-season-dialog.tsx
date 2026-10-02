import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function ServiceSeasonDialog({
  service, selectedMonths, onSave, onClose,
}: {
  service: string;
  selectedMonths: number[];
  onSave: (months: number[]) => string | undefined;
  onClose: () => void;
}) {
  const headingId = useId();
  const [draft, setDraft] = useState(() => [...selectedMonths]);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('.modal-close')?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const save = () => {
    try {
      const result = onSave([...draft]);
      if (result) {
        setError(result);
        return;
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The service season could not be saved.');
    }
  };

  return (
    <div
      className="post-modal-backdrop season-month-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        ref={dialogRef}
        aria-labelledby={headingId}
        aria-modal="true"
        className="post-modal season-month-dialog"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header className="post-modal-header">
          <div>
            <p className="post-modal-kicker">Service season</p>
            <h2 id={headingId}>{service}</h2>
            <p className="post-modal-intro">Choose the months this service is in season.</p>
          </div>
          <button
            aria-label={`Close ${service} season settings`}
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </header>
        <div className="season-month-dialog-body">
          <p>Select every month that applies. Changes take effect after saving.</p>
          <div className="season-month-dialog-grid">
            {months.map((month, index) => {
              const monthNumber = index + 1;
              const selected = draft.includes(monthNumber);
              return (
                <button
                  aria-label={`${selected ? 'Remove' : 'Add'} ${month} ${selected ? 'from' : 'to'} ${service} season`}
                  aria-pressed={selected}
                  className="airtime-month-toggle"
                  key={month}
                  onClick={() => setDraft((current) => selected
                    ? current.filter((item) => item !== monthNumber)
                    : [...current, monthNumber].sort((a, b) => a - b))}
                  type="button"
                >
                  {month}
                </button>
              );
            })}
          </div>
          {error && <p role="alert" className="form-error">{error}</p>}
        </div>
        <div className="post-form-actions season-month-dialog-actions">
          <button className="cancel-button" onClick={onClose} type="button">Cancel</button>
          <button className="save-post-button" onClick={save} type="button">Save</button>
        </div>
      </section>
    </div>
  );
}
