import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, getErrorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import type { Item, ItemInput } from '../../types';
import { centsToInputValue, parseDollarsToCents } from '../../utils/money';

interface ItemFormModalProps {
  /** Pass an item to edit it ("Modify item"); omit to create one ("Add new item"). */
  item?: Item;
  onCancel: () => void;
  onSubmit: (input: ItemInput) => Promise<void>;
}

type FieldName = 'name' | 'quantity' | 'unitPrice' | 'tags' | 'note';
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

const SERVER_FIELD_TO_FORM_FIELD: Record<string, FieldName> = {
  name: 'name',
  quantity: 'quantity',
  unitPriceCents: 'unitPrice',
  tags: 'tags',
  note: 'note',
};

function toFormValues(item?: Item): FormValues {
  return {
    name: item?.name ?? '',
    quantity: item ? String(item.quantity) : '',
    unitPrice: item ? centsToInputValue(item.unitPriceCents) : '',
    tags: item?.tags.join(', ') ?? '',
    note: item?.note ?? '',
  };
}

function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function validate(values: FormValues): { input?: ItemInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const quantity = Number(values.quantity);
  const unitPriceCents = parseDollarsToCents(values.unitPrice);
  const tags = parseTags(values.tags);

  if (!name) errors.name = 'Name is required';
  if (values.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 0) {
    errors.quantity = 'Enter a whole number, 0 or more';
  }
  if (unitPriceCents === null) errors.unitPrice = 'Enter a price like 5 or 5.99';
  if (tags.length > 10) errors.tags = 'At most 10 tags';
  if (tags.some((tag) => tag.length > 30)) errors.tags = 'Each tag must be 30 characters or less';

  if (Object.keys(errors).length > 0) return { errors };
  return {
    input: { name, quantity, unitPriceCents: unitPriceCents!, tags, note: values.note.trim() },
    errors,
  };
}

export function ItemFormModal({ item, onCancel, onSubmit }: ItemFormModalProps) {
  const isEditing = item !== undefined;
  const [values, setValues] = useState<FormValues>(() => toFormValues(item));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const { input, errors: validationErrors } = validate(values);
    setErrors(validationErrors);
    if (!input) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        const serverErrors: FieldErrors = {};
        for (const { field, message } of error.fieldErrors) {
          const formField = SERVER_FIELD_TO_FORM_FIELD[field.split('.')[0] ?? ''];
          if (formField) serverErrors[formField] = message;
        }
        setErrors(serverErrors);
      }
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  const fieldProps = (field: FieldName) => ({
    id: `item-${field}`,
    value: values[field],
    onChange: (event: { target: { value: string } }) => setField(field, event.target.value),
    'aria-invalid': errors[field] ? true : undefined,
  });

  return (
    <Modal
      title={isEditing ? 'Modify item' : 'Add new item'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="item-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label>ID</label>
          <span className="form-row__static">{item?.id ?? 'Assigned on save'}</span>
        </div>

        <FormRow label="Name" htmlFor="item-name" error={errors.name}>
          <input {...fieldProps('name')} placeholder="Item 1" autoFocus maxLength={120} />
        </FormRow>

        <FormRow label="Qty" htmlFor="item-quantity" error={errors.quantity}>
          <input {...fieldProps('quantity')} inputMode="numeric" placeholder="100" />
        </FormRow>

        <FormRow label="Unit price (CAD)" htmlFor="item-unitPrice" error={errors.unitPrice}>
          <input {...fieldProps('unitPrice')} inputMode="decimal" placeholder="5.00" />
        </FormRow>

        <FormRow label="Tags" htmlFor="item-tags" error={errors.tags}>
          <input {...fieldProps('tags')} placeholder="Tag, Tag" />
        </FormRow>

        <div className="form-stack">
          <label htmlFor="item-note">Note</label>
          <textarea {...fieldProps('note')} rows={4} maxLength={1000} />
        </div>

        {submitError && <p className="form-error">{submitError}</p>}
      </form>
    </Modal>
  );
}

interface FormRowProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

function FormRow({ label, htmlFor, error, children }: FormRowProps) {
  return (
    <div className="form-row">
      <label htmlFor={htmlFor}>{label}</label>
      <div className="form-row__control">
        {children}
        {error && <span className="field-error">{error}</span>}
      </div>
    </div>
  );
}
