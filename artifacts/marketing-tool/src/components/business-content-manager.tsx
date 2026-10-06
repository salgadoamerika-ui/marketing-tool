import { useId, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import './business-content-manager.css';

type ContentKind = 'content type' | 'platform';

type BusinessContentManagerProps = {
  businessName: string;
  contentTypes: string[];
  platforms: string[];
  onAdd: (kind: ContentKind, name: string) => string | undefined;
  onRename: (kind: ContentKind, oldName: string, newName: string) => string | undefined;
  onDelete: (kind: ContentKind, name: string) => string | undefined;
  onClose: () => void;
};

type CatalogSectionProps = {
  kind: ContentKind;
  title: string;
  description: string;
  items: string[];
  addLabel: string;
  deleteNote: string;
  onAdd: BusinessContentManagerProps['onAdd'];
  onRename: BusinessContentManagerProps['onRename'];
  onDelete: BusinessContentManagerProps['onDelete'];
};

function CatalogSection({
  kind,
  title,
  description,
  items,
  addLabel,
  deleteNote,
  onAdd,
  onRename,
  onDelete,
}: CatalogSectionProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [error, setError] = useState('');
  const inputId = useId();

  const validateName = (value: string, except?: string) => {
    const name = value.trim();
    if (!name) return `Enter a ${kind} name.`;
    if (name.length > 48) return 'Keep names under 48 characters.';
    if (items.some((item) => item !== except && item.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      return `That ${kind} is already in this business.`;
    }
    return undefined;
  };

  const add = () => {
    const name = newName.trim();
    const validationError = validateName(name);
    if (validationError) { setError(validationError); return; }
    const result = onAdd(kind, name);
    if (result) { setError(result); return; }
    setNewName('');
    setAdding(false);
    setError('');
  };

  const rename = (oldName: string) => {
    const name = editedName.trim();
    const validationError = validateName(name, oldName);
    if (validationError) { setError(validationError); return; }
    if (name !== oldName) {
      const result = onRename(kind, oldName, name);
      if (result) { setError(result); return; }
    }
    setEditing(null);
    setEditedName('');
    setError('');
  };

  const remove = (name: string) => {
    const result = onDelete(kind, name);
    if (result) { setError(result); return; }
    if (editing === name) {
      setEditing(null);
      setEditedName('');
    }
    setError('');
  };

  return (
    <section aria-label={title} className="bcm-section">
      <div className="bcm-section-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {!adding && (
          <button
            className="bcm-add"
            onClick={() => { setAdding(true); setError(''); }}
            type="button"
          >
            <Plus size={14} aria-hidden="true" />
            {addLabel}
          </button>
        )}
      </div>

      <ul className="bcm-list">
        {items.map((item) => (
          <li className="bcm-item" key={item}>
            {editing === item ? (
              <input
                aria-label={`Rename ${kind} ${item}`}
                autoFocus
                maxLength={48}
                onChange={(event) => { setEditedName(event.target.value); setError(''); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); rename(item); }
                  if (event.key === 'Escape') { setEditing(null); setError(''); }
                }}
                value={editedName}
              />
            ) : (
              <span className="bcm-item-name">{item}</span>
            )}
            <div className="bcm-item-actions">
              {editing === item ? (
                <>
                  <button className="bcm-small-action bcm-save" onClick={() => rename(item)} type="button">Save</button>
                  <button
                    aria-label={`Cancel renaming ${kind} ${item}`}
                    className="bcm-small-action bcm-icon-action"
                    onClick={() => { setEditing(null); setError(''); }}
                    type="button"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  aria-label={`Edit ${kind} ${item}`}
                  className="bcm-small-action bcm-icon-action"
                  onClick={() => { setEditing(item); setEditedName(item); setError(''); }}
                  type="button"
                >
                  <Pencil size={14} aria-hidden="true" />
                  <span>Edit</span>
                </button>
              )}
              <button
                aria-label={`Delete ${kind} ${item}`}
                className="bcm-small-action bcm-delete"
                onClick={() => remove(item)}
                type="button"
              >
                <Trash2 size={14} aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="bcm-empty">Nothing here yet. Add a {kind} to make it available.</li>
        )}
      </ul>

      {adding && (
        <form
          className="bcm-add-form"
          onSubmit={(event) => { event.preventDefault(); add(); }}
        >
          <label htmlFor={inputId}>New {kind} name</label>
          <div className="bcm-add-controls">
            <input
              autoFocus
              id={inputId}
              maxLength={48}
              onChange={(event) => { setNewName(event.target.value); setError(''); }}
              placeholder={`${kind === 'content type' ? 'e.g. Case study' : 'e.g. LinkedIn'}`}
              value={newName}
            />
            <button className="bcm-small-action bcm-save" type="submit">Add</button>
            <button
              aria-label={`Cancel adding ${kind}`}
              className="bcm-small-action bcm-icon-action"
              onClick={() => { setAdding(false); setNewName(''); setError(''); }}
              type="button"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      <p className="bcm-delete-note">{deleteNote}</p>
      <p className="bcm-error" role="alert">{error}</p>
    </section>
  );
}

export function BusinessContentManager({
  businessName,
  contentTypes,
  platforms,
  onAdd,
  onRename,
  onDelete,
  onClose,
}: BusinessContentManagerProps) {
  const titleId = useId();
  return (
    <div className="bcm-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="bcm-dialog"
        onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
        role="dialog"
      >
        <header className="bcm-header">
          <div>
            <p className="bcm-kicker">{businessName}</p>
            <h2 id={titleId}>Manage content</h2>
            <p className="bcm-intro">Content types and platforms are saved separately for each business.</p>
          </div>
          <button aria-label="Close content manager" className="bcm-close" onClick={onClose} type="button">
            <X size={17} strokeWidth={1.8} />
          </button>
        </header>
        <div className="bcm-body">
          <CatalogSection
            addLabel="Add content type"
            deleteNote="Deleting a type removes its label from this business’s saved posts. Suggestions that need it are skipped."
            description="Choose the post formats available in Add a post."
            items={contentTypes}
            kind="content type"
            onAdd={onAdd}
            onDelete={onDelete}
            onRename={onRename}
            title="Content types"
          />
          <CatalogSection
            addLabel="Add platform"
            deleteNote="Deleting a platform removes it from this business’s saved posts, services, and post options."
            description="Choose where this business can publish."
            items={platforms}
            kind="platform"
            onAdd={onAdd}
            onDelete={onDelete}
            onRename={onRename}
            title="Platforms"
          />
        </div>
      </section>
    </div>
  );
}
