import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import './business-manager.css';

type Props = {
  initialAction?: 'edit' | 'delete';
  businessName: string;
  serviceCount: number;
  postCount: number;
  onRename(name: string): string | undefined;
  onDelete(): string | undefined;
  onClose(): void;
};

export function BusinessManager({ initialAction = 'edit', businessName, serviceCount, postCount, onRename, onDelete, onClose }: Props) {
  const [name, setName] = useState(businessName);
  const [deleting, setDeleting] = useState(initialAction === 'delete');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="business-manager">
        <DialogTitle className="business-manager-title">{deleting ? 'Delete this business?' : 'Edit business'}</DialogTitle>
        <DialogDescription className="business-manager-description">
          {deleting
            ? `Permanently delete ${businessName}, its ${serviceCount} services and ${postCount} saved posts, including results, learning, suggestions, notifications, and settings. This cannot be undone. Other businesses will not change.`
            : 'Your business and its services are separate. Renaming the business keeps all services, posts, results, and learning as they are.'}
        </DialogDescription>
        {deleting ? (
          <form className="business-manager-form" onSubmit={(event) => {
            event.preventDefault();
            if (confirmation !== businessName) return;
            const result = onDelete();
            if (result) setError(result);
          }}>
            <label htmlFor="confirm-business-deletion">Type “{businessName}” to confirm</label>
            <input id="confirm-business-deletion" value={confirmation} autoComplete="off"
              onChange={(event) => { setConfirmation(event.target.value); setError(''); }} />
            {error && <p className="business-manager-error" role="alert">{error}</p>}
            <div className="business-manager-actions">
              <button type="button" className="cancel-button" onClick={() => {
                setDeleting(false); setConfirmation(''); setError('');
              }}>Keep business</button>
              <button type="submit" className="business-delete-confirm" disabled={confirmation !== businessName}>
                <Trash2 size={15} aria-hidden="true" /> Delete business permanently
              </button>
            </div>
          </form>
        ) : (
          <>
            <form className="business-manager-form" onSubmit={(event) => {
              event.preventDefault();
              const result = onRename(name);
              if (result) setError(result);
              else onClose();
            }}>
              <label htmlFor="rename-business">Business name</label>
              <input id="rename-business" value={name} required autoComplete="organization"
                onChange={(event) => { setName(event.target.value); setError(''); }} />
              {error && <p className="business-manager-error" role="alert">{error}</p>}
              <div className="business-manager-actions">
                <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
                <button type="submit" className="save-button">Save business name</button>
              </div>
            </form>
            <div className="business-manager-danger">
              <p>Remove this business and everything inside it.</p>
              <button type="button" onClick={() => { setDeleting(true); setError(''); }}>
                <Trash2 size={15} aria-hidden="true" /> Delete business
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
