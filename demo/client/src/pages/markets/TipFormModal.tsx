import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import type { Market, Sale, SaleInput } from '../../types';
import { dateInputValueToIso, isoToDateInputValue } from '../../utils/date';
import { centsToInputValue, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

interface TipFormModalProps {
  market: Market;
  channelId: number;
  /** Pass a tip-only sale to edit it; omit to add a tip. */
  sale?: Sale;
  onCancel: () => void;
  onSubmit: (input: SaleInput) => Promise<void>;
}

/** A tip is saved as a dated, item-free sale on the market, so it counts toward revenue. */
export function TipFormModal({ market, channelId, sale, onCancel, onSubmit }: TipFormModalProps) {
  const [date, setDate] = useState(sale ? isoToDateInputValue(sale.soldAt) : market.startDate);
  const [amount, setAmount] = useState(sale ? centsToInputValue(sale.items[0]?.totalCents ?? 0) : '');
  const [errors, setErrors] = useState<{ date?: string; amount?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const soldAt = dateInputValueToIso(date);
    const cents = parseDollarsToCents(amount);
    const found: typeof errors = {};
    if (!soldAt) found.date = 'Pick a date';
    if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS)
      found.amount = 'Enter a number like 2 or 2.50';
    setErrors(found);
    if (!soldAt || cents === null || Object.keys(found).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        soldAt,
        channelId,
        description: '',
        tags: sale?.tags ?? [],
        items: [],
        marketId: market.id,
        currency: market.currency,
        tipCents: cents,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={sale ? 'Modify tip' : 'Add tip'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="tip-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="tip-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <FormRow label="Date" htmlFor="tip-date" error={errors.date} required>
          <input id="tip-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
        <FormRow label={`Amount (${market.currency})`} htmlFor="tip-amount" error={errors.amount} required>
          <input
            id="tip-amount"
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormRow>
        {submitError && (
          <div className="banner banner--error" role="alert">
            {submitError}
          </div>
        )}
      </form>
    </Modal>
  );
}
