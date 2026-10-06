import { type FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export function BusinessDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => string | undefined;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = 'business-dialog-title';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = onCreate(name);
    if (result) {
      setError(result);
      return;
    }
    onClose();
  };

  return (
    <div
      className="post-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
            onClose();
          }
        }}
        role="dialog"
      >
        <div className="post-modal-header">
          <div>
            <p className="post-modal-kicker">Separate workspace</p>
            <h2 id={titleId}>Add a business</h2>
            <p className="post-modal-intro">
              Its services, calendar, results, airtime, and learning stay separate from your other businesses.
            </p>
          </div>
          <button aria-label="Close add business form" className="modal-close" onClick={onClose} type="button">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form className="post-form" noValidate onSubmit={submit}>
          <label className="form-field" htmlFor="business-name">
            <span>Business name <b>*</b></span>
            <input
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'business-name-error' : undefined}
              autoComplete="organization"
              id="business-name"
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
              placeholder="e.g. Northside Studio"
              ref={inputRef}
              required
              type="text"
              value={name}
            />
          </label>
          {error && <p className="form-error" id="business-name-error" role="alert">{error}</p>}
          <div className="post-form-actions">
            <button className="cancel-button" onClick={onClose} type="button">Cancel</button>
            <button className="save-post-button" type="submit">Create business</button>
          </div>
        </form>
      </section>
    </div>
  );
}
