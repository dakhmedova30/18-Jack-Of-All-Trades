import { useState } from 'react';
import { getErrorMessage } from '../api/http';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="small"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={handleConfirm}
            disabled={pending}
            autoFocus
          >
            {pending ? 'Deleting…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{message}</p>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
