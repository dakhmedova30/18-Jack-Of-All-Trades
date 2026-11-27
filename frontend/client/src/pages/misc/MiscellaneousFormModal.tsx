import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import type { MiscellaneousInput, MiscellaneousRecord } from '../../types';

interface MiscellaneousFormModalProps {
  record?: MiscellaneousRecord;
  knownTags: string[];
  onCancel: () => void;
  onSubmit: (input: MiscellaneousInput) => Promise<void>;
}

export function MiscellaneousFormModal({
  record,
  knownTags,
  onCancel,
  onSubmit,
}: MiscellaneousFormModalProps) {
  const [name, setName] = useState(record?.name ?? '');
  const [receivedOn, setReceivedOn] = useState(
    record?.receivedOn ?? new Date().toISOString().slice(0, 10),
  );
  const [tags, setTags] = useState<string[]>(record?.tags ?? []);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    receivedOn?: string;
    tags?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  function close() {
    if (
      dirty &&
      !window.confirm('You have unsaved information. Are you sure you want to discard it?')
    ) {
      return;
    }
    onCancel();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = 'Name is required';
    if (!receivedOn) errors.receivedOn = 'Pick a date';
    if (tags.length > 10) errors.tags = 'At most 10 tags';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), receivedOn, tags });
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
      title={record ? 'Modify miscellaneous record' : 'Add miscellaneous record'}
      onClose={close}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={close}>
            Cancel
          </button>
          <button type="submit" form="miscellaneous-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="miscellaneous-form" className="item-form" onSubmit={submit} noValidate>
        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{record?.id ?? 'Assigned on save'}</span>
        </div>
        <FormRow label="Name" htmlFor="miscellaneous-name" error={fieldErrors.name} required>
          <input
            id="miscellaneous-name"
            value={name}
            maxLength={120}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? 'miscellaneous-name-error' : undefined}
            onChange={(event) => {
              setDirty(true);
              setName(event.target.value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
          />
        </FormRow>
        <FormRow label="Date" htmlFor="miscellaneous-date" error={fieldErrors.receivedOn} required>
          <input
            id="miscellaneous-date"
            type="date"
            value={receivedOn}
            aria-invalid={fieldErrors.receivedOn ? true : undefined}
            aria-describedby={fieldErrors.receivedOn ? 'miscellaneous-date-error' : undefined}
            onChange={(event) => {
              setDirty(true);
              setReceivedOn(event.target.value);
              setFieldErrors((current) => ({ ...current, receivedOn: undefined }));
            }}
          />
        </FormRow>
        <SelectWithAddRow
          id="miscellaneous-tag"
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
          error={fieldErrors.tags ?? null}
          maxLength={30}
          placeholder="e.g. Offline"
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
