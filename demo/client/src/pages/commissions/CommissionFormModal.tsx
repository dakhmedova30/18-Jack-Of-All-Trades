import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import type { Commission, CommissionInput } from '../../types';

interface CommissionFormModalProps {
  commission?: Commission;
  knownTags: string[];
  onCancel: () => void;
  onSubmit: (input: CommissionInput) => Promise<void>;
}

export function CommissionFormModal({
  commission,
  knownTags,
  onCancel,
  onSubmit,
}: CommissionFormModalProps) {
  const [name, setName] = useState(commission?.name ?? '');
  const [contact, setContact] = useState(commission?.contact ?? '');
  const [request, setRequest] = useState(commission?.request ?? '');
  const [deadline, setDeadline] = useState(commission?.deadline ?? new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState<string[]>(commission?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  function close() {
    if (dirty && !window.confirm('You have unsaved information. Are you sure you want to discard it?')) {
      return;
    }
    onCancel();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !deadline) {
      setError(!name.trim() ? 'Name is required' : 'Pick a deadline');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), contact: contact.trim(), request: request.trim(), deadline, tags });
    } catch (caught) {
      setError(getErrorMessage(caught));
      setSubmitting(false);
    }
  }

  const tagOptions = [...new Set([...knownTags, ...tags])]
    .filter((tag) => !tags.includes(tag))
    .map((tag) => ({ value: tag, label: tag }));

  return (
    <Modal
      title={commission ? 'Modify commission' : 'Add commission'}
      onClose={close}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" form="commission-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="commission-form" className="item-form" onSubmit={submit} noValidate>
        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{commission?.id ?? 'Assigned on save'}</span>
        </div>
        <FormRow label="Name" htmlFor="commission-name" required>
          <input
            id="commission-name"
            value={name}
            maxLength={120}
            onChange={(event) => {
              setDirty(true);
              setName(event.target.value);
            }}
          />
        </FormRow>
        <FormRow label="Contact" htmlFor="commission-contact">
          <input
            id="commission-contact"
            value={contact}
            maxLength={200}
            onChange={(event) => {
              setDirty(true);
              setContact(event.target.value);
            }}
          />
        </FormRow>
        <FormRow label="Request" htmlFor="commission-request">
          <textarea
            id="commission-request"
            value={request}
            maxLength={1000}
            rows={4}
            onChange={(event) => {
              setDirty(true);
              setRequest(event.target.value);
            }}
          />
        </FormRow>
        <FormRow label="Deadline" htmlFor="commission-deadline" required>
          <input
            id="commission-deadline"
            type="date"
            value={deadline}
            onChange={(event) => {
              setDirty(true);
              setDeadline(event.target.value);
            }}
          />
        </FormRow>
        <SelectWithAddRow
          id="commission-tag"
          label="Tags"
          noun="tag"
          options={tagOptions}
          loadError={null}
          value=""
          onChange={(tag) => {
            if (!tag) return;
            setDirty(true);
            setTags((current) => (current.includes(tag) ? current : [...current, tag]));
          }}
          onAdd={async (tag) => tag}
          error={tags.length > 10 ? 'At most 10 tags' : null}
          maxLength={30}
          placeholder="e.g. Portrait"
        />
        {tags.length > 0 && (
          <div className="form-row">
            <span className="form-row__label" />
            <div className="form-row__control item-form__tags">
              {tags.map((tag) => (
                <span key={tag} className="item-form__tag">
                  {tag}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => {
                      setDirty(true);
                      setTags((current) => current.filter((entry) => entry !== tag));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {error && (
          <div className="banner banner--error" role="alert">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
