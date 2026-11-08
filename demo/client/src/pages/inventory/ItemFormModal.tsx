import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, getErrorMessage } from '../../api/http';
import { listItemTags } from '../../api/items';
import { Modal } from '../../components/Modal';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import { useCurrency } from '../../hooks/useCurrency';
import {
  CURRENCY_CODES,
  SIZE_UNITS,
  type CurrencyCode,
  type Item,
  type ItemInput,
  type SizeUnit,
} from '../../types';
import {
  centsToInputValue,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DISPLAY,
  parseDollarsToCents,
} from '../../utils/money';

interface ItemFormModalProps {
  /** Pass an item to edit it ("Modify item"); omit to create one ("Add new item"). */
  item?: Item;
  onCancel: () => void;
  onSubmit: (input: ItemInput) => Promise<void>;
}

type FieldName = 'name' | 'quantity' | 'unitPrice' | 'width' | 'height' | 'amountSold' | 'tags' | 'note';
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

const SERVER_FIELD_TO_FORM_FIELD: Record<string, FieldName> = {
  name: 'name',
  quantity: 'quantity',
  unitPriceCents: 'unitPrice',
  width: 'width',
  height: 'height',
  amountSold: 'amountSold',
  tags: 'tags',
  note: 'note',
};

function toFormValues(item?: Item): FormValues {
  return {
    name: item?.name ?? '',
    quantity: item ? String(item.quantity) : '',
    unitPrice: item ? centsToInputValue(item.unitPriceCents) : '',
    width: item?.width != null ? String(item.width) : '',
    height: item?.height != null ? String(item.height) : '',
    amountSold: item ? String(item.amountSold) : '',
    tags: '',
    note: item?.note ?? '',
  };
}

interface Extras {
  isPublic: boolean;
  isActive: boolean;
  currency: CurrencyCode;
  sizeUnit: SizeUnit;
  tags: string[];
}

function parseSizeValue(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 99999.99
    ? Math.round(value * 100) / 100
    : null;
}

function validate(values: FormValues, extras: Extras): { input?: ItemInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const quantity = Number(values.quantity);
  const unitPriceCents = parseDollarsToCents(values.unitPrice);
  const { tags } = extras;
  const hasWidth = values.width.trim() !== '';
  const hasHeight = values.height.trim() !== '';
  const amountSoldText = values.amountSold.trim();
  const amountSold = amountSoldText === '' ? 0 : Number(amountSoldText);

  if (!name) errors.name = 'Name is required';
  if (values.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 0) {
    errors.quantity = 'Enter a whole number, 0 or more';
  }
  if (unitPriceCents === null) errors.unitPrice = 'Enter a price like 5 or 5.99';
  else if (unitPriceCents < 0 || unitPriceCents > MAX_AMOUNT_CENTS) {
    errors.unitPrice = `Price must be between 0.00 and ${MAX_AMOUNT_DISPLAY}`;
  }
  if (hasWidth && parseSizeValue(values.width) === null) errors.width = 'Enter a number above 0';
  if (hasHeight && parseSizeValue(values.height) === null) errors.height = 'Enter a number above 0';
  if (hasWidth !== hasHeight) {
    errors[hasWidth ? 'height' : 'width'] = 'Enter both width and height, or leave both blank';
  }
  if (!Number.isInteger(amountSold) || amountSold < 0) {
    errors.amountSold = 'Enter a whole number, 0 or more';
  }
  if (tags.length > 10) errors.tags = 'At most 10 tags';

  if (Object.keys(errors).length > 0) return { errors };
  const hasSize = hasWidth && hasHeight;
  return {
    input: {
      name,
      quantity,
      unitPriceCents: unitPriceCents!,
      currency: extras.currency,
      width: hasSize ? parseSizeValue(values.width) : null,
      height: hasSize ? parseSizeValue(values.height) : null,
      sizeUnit: hasSize ? extras.sizeUnit : null,
      amountSold,
      tags,
      note: values.note.trim(),
      isPublic: extras.isPublic,
      isActive: extras.isActive,
    },
    errors,
  };
}

export function ItemFormModal({ item, onCancel, onSubmit }: ItemFormModalProps) {
  const businessCurrency = useCurrency();
  const isEditing = item !== undefined;
  const [values, setValues] = useState<FormValues>(() => toFormValues(item));
  const [isPublic, setIsPublic] = useState(item?.isPublic ?? false);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [currency, setCurrency] = useState<CurrencyCode>(
    (item?.currency ?? businessCurrency) as CurrencyCode,
  );
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(item?.sizeUnit ?? 'in');
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [knownTags, setKnownTags] = useState<string[] | null>(null);
  const [tagsLoadError, setTagsLoadError] = useState<string | null>(null);
  const [hasUnsavedInput, setHasUnsavedInput] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listItemTags()
      .then((entries) => setKnownTags(entries.map((entry) => entry.name)))
      .catch((error: unknown) => setTagsLoadError(getErrorMessage(error)));
  }, []);

  const tagOptions =
    knownTags &&
    [...new Set([...knownTags, ...tags])]
      .filter((name) => !tags.includes(name))
      .map((name) => ({ value: name, label: name }));

  function addTag(name: string) {
    if (!name) return;
    setHasUnsavedInput(true);
    setTags((current) => (current.includes(name) ? current : [...current, name]));
    setErrors((current) => ({ ...current, tags: undefined }));
  }

  function setField(field: FieldName, value: string) {
    setHasUnsavedInput(true);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleCancel() {
    if (
      hasUnsavedInput &&
      !window.confirm('You have unsaved information. Are you sure you want to discard it?')
    ) {
      return;
    }
    onCancel();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const { input, errors: validationErrors } = validate(values, {
      isPublic,
      isActive,
      currency,
      sizeUnit,
      tags,
    });
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
    'aria-describedby': errors[field] ? `item-${field}-error` : undefined,
  });

  return (
    <Modal
      title={isEditing ? 'Modify item' : 'Add new item'}
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
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
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{item?.id ?? 'Assigned on save'}</span>
        </div>

        <FormRow label="Name" htmlFor="item-name" error={errors.name} required>
          <input {...fieldProps('name')} placeholder="Item 1" maxLength={120} required />
        </FormRow>

        <FormRow label="Size" htmlFor="item-width" error={errors.width ?? errors.height}>
          <div className="item-form__size">
            <input
              {...fieldProps('width')}
              inputMode="decimal"
              placeholder="Width"
              aria-label="Width"
            />
            <span aria-hidden="true">×</span>
            <input
              {...fieldProps('height')}
              inputMode="decimal"
              placeholder="Height"
              aria-label="Height"
            />
            <select
              aria-label="Size unit"
              value={sizeUnit}
              onChange={(event) => {
                setHasUnsavedInput(true);
                setSizeUnit(event.target.value as SizeUnit);
              }}
            >
              {SIZE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </FormRow>

        <FormRow label="Currency" htmlFor="item-currency">
          <select
            id="item-currency"
            value={currency}
            onChange={(event) => {
              setHasUnsavedInput(true);
              setCurrency(event.target.value as CurrencyCode);
            }}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow
          label={`Price (${currency})`}
          hint={`0.00–${MAX_AMOUNT_DISPLAY}`}
          htmlFor="item-unitPrice"
          error={errors.unitPrice}
          required
        >
          <input {...fieldProps('unitPrice')} inputMode="decimal" placeholder="5.00" required />
        </FormRow>

        <FormRow label="Qty" htmlFor="item-quantity" error={errors.quantity} required>
          <input {...fieldProps('quantity')} inputMode="numeric" placeholder="100" required />
        </FormRow>

        <FormRow
          label="Amount sold"
          hint="Optional"
          htmlFor="item-amountSold"
          error={errors.amountSold}
        >
          <input {...fieldProps('amountSold')} inputMode="numeric" placeholder="0" />
        </FormRow>

        <SelectWithAddRow
          id="item-tag"
          label="Tags"
          noun="tag"
          options={tagOptions ?? null}
          loadError={tagsLoadError}
          value=""
          onChange={addTag}
          onAdd={async (name) => name}
          error={errors.tags ?? null}
          maxLength={30}
          placeholder="e.g. Print"
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
                      setHasUnsavedInput(true);
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

        <FormRow label="Active" htmlFor="item-isActive">
          <label className="item-form__check">
            <input
              id="item-isActive"
              type="checkbox"
              checked={isActive}
              onChange={(event) => {
                setHasUnsavedInput(true);
                setIsActive(event.target.checked);
              }}
            />
            Available to sell (uncheck to deactivate)
          </label>
        </FormRow>

        <FormRow label="Public" htmlFor="item-isPublic">
          <label className="item-form__check">
            <input
              id="item-isPublic"
              type="checkbox"
              checked={isPublic}
              onChange={(event) => {
                setHasUnsavedInput(true);
                setIsPublic(event.target.checked);
              }}
            />
            Show on my public profile
          </label>
        </FormRow>

        <div className="form-stack">
          <label htmlFor="item-note">Note</label>
          <textarea {...fieldProps('note')} rows={4} maxLength={1000} />
        </div>

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}

interface FormRowProps {
  label: string;
  hint?: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

function FormRow({ label, hint, htmlFor, error, required = false, children }: FormRowProps) {
  return (
    <div className="form-row">
      <label htmlFor={htmlFor}>
        <span>
          {label}
          {required && (
            <span className="required-marker" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
        {hint && <span className="field-label__hint">{hint}</span>}
      </label>
      <div className="form-row__control">
        {children}
        {error && (
          <span
            id={`item-${htmlFor.replace('item-', '')}-error`}
            className="field-error"
            aria-live="polite"
          >
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
