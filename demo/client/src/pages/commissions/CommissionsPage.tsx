import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  bulkDeleteCommissions,
  createCommission,
  deleteCommission,
  listCommissions,
  updateCommission,
} from '../../api/commissions';
import { getErrorMessage } from '../../api/http';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import type { Commission, CommissionInput } from '../../types';
import { centsToInputValue, formatCentsIn, MAX_AMOUNT_CENTS, MAX_AMOUNT_DISPLAY, parseDollarsToCents } from '../../utils/money';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useReportingCurrency } from '../../hooks/useReportingCurrency';

type FormState = 'create' | { mode: 'edit'; commission: Commission } | null;
type DeleteTarget = { kind: 'single'; commission: Commission } | { kind: 'bulk'; ids: number[] } | null;

export function CommissionsPage() {
  const { currency: businessCurrency, rates, error: ratesError, formatCad } = useReportingCurrency();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCommissions({
      search,
      from: fromDate || undefined,
      to: toDate || undefined,
      currency: currencyFilter || undefined,
    })
      .then((result) => {
        if (!cancelled) {
          setCommissions(result);
          setSelectedIds(new Set());
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(getErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadToken, search, fromDate, toDate, currencyFilter]);

  const totals = commissions.reduce(
    (result, commission) => ({
      expenses: result.expenses + commission.expensesCadCents,
      revenue: result.revenue + commission.revenueCadCents,
      profit: result.profit + commission.profitCadCents,
    }),
    { expenses: 0, revenue: 0, profit: 0 },
  );
  const allSelected = commissions.length > 0 && commissions.every((commission) => selectedIds.has(commission.id));

  async function save(input: CommissionInput) {
    if (formState && typeof formState === 'object') {
      await updateCommission(formState.commission.id, input);
    } else {
      await createCommission(input);
    }
    setFormState(null);
    setReloadToken((value) => value + 1);
  }

  async function remove() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.commission.id] : deleteTarget.ids;
    if (deleteTarget.kind === 'single') await deleteCommission(deleteTarget.commission.id);
    else await bulkDeleteCommissions(ids);
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);
    setReloadToken((value) => value + 1);
  }

  return (
    <section className="page feature-dashboard">
      <header className="feature-dashboard__header">
        <div>
          <h1>Commissions</h1>
          <p className="muted">Track custom requests, deadlines, revenue, expenses, and profit.</p>
        </div>
        <button type="button" className="button" onClick={() => setFormState('create')}>
          Add commission <PlusIcon />
        </button>
      </header>

      {error && (
        <div className="banner banner--error" role="alert">
          Could not load commissions: {error}{' '}
          <button type="button" className="link-button" onClick={() => setReloadToken((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}

      {ratesError && <div className="banner banner--error" role="alert">Could not load currency rates: {ratesError}</div>}
      <div className="market-summary feature-dashboard__stats">
        <SummaryCard label="Expenses" value={formatCad(totals.expenses)} />
        <SummaryCard label="Revenue" value={formatCad(totals.revenue)} />
        <SummaryCard label="Profit" value={formatCad(totals.profit)} negative={totals.profit < 0} />
      </div>

      <div className="toolbar">
        <button
          type="button"
          className="button button--secondary"
          disabled={selectedIds.size === 0}
          onClick={() => setDeleteTarget({ kind: 'bulk', ids: [...selectedIds] })}
        >
          Bulk delete{selectedIds.size > 0 && ` (${selectedIds.size})`} <TrashIcon />
        </button>
        <div className="search-field">
          <label htmlFor="commissions-search">Search all commission fields</label>
          <div className="search">
            <input id="commissions-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <SearchIcon />
          </div>
        </div>
      </div>
      <div className="toolbar__filters" aria-label="Filter commissions">
        <label>Deadline from<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>Deadline to<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <label>Currency
          <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)}>
            <option value="">All currencies</option>
            {(rates?.currencies ?? []).map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}
          </select>
        </label>
      </div>

      <section className="card feature-dashboard__records">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="table__check">
                  <input type="checkbox" checked={allSelected} onChange={() => setSelectedIds((current) => {
                    if (allSelected) return new Set([...current].filter((id) => !commissions.some((commission) => commission.id === id)));
                    return new Set([...current, ...commissions.map((commission) => commission.id)]);
                  })} aria-label="Select all commissions" />
                </th>
                <th>ID</th><th>Name / Request</th><th>Contact</th><th>Deadline</th>
                <th className="numeric">Expenses</th><th className="numeric">Revenue</th>
                <th className="numeric">Profit</th><th>Currency</th><th className="table__action">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission) => (
                <tr key={commission.id}>
                  <td className="table__check">
                    <input type="checkbox" checked={selectedIds.has(commission.id)} onChange={() => setSelectedIds((current) => {
                      const next = new Set(current);
                      if (next.has(commission.id)) next.delete(commission.id); else next.add(commission.id);
                      return next;
                    })} aria-label={`Select commission ${commission.id}`} />
                  </td>
                  <td>{commission.id}</td>
                  <td>
                    <strong>{commission.name}</strong>
                    {commission.request && <span className="feature-dashboard__subtext">{commission.request}</span>}
                  </td>
                  <td>{commission.contact || <span className="muted">—</span>}</td>
                  <td>{commission.deadline ? new Date(`${commission.deadline}T12:00:00`).toLocaleDateString() : <span className="muted">—</span>}</td>
                  <td className="numeric">{formatCentsIn(commission.expensesCents, commission.currency)}</td>
                  <td className="numeric">{formatCentsIn(commission.revenueCents, commission.currency)}</td>
                  <td className={`numeric${commission.profitCents < 0 ? ' negative' : ''}`}>{formatCentsIn(commission.profitCents, commission.currency)}</td>
                  <td>{commission.currency}</td>
                  <td className="table__action">
                    <div className="table-actions">
                      <button type="button" className="button button--secondary" onClick={() => setFormState({ mode: 'edit', commission })}>Edit</button>
                      <button type="button" className="icon-button" aria-label={`Delete ${commission.name}`} onClick={() => setDeleteTarget({ kind: 'single', commission })}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {commissions.length > 0 && (
              <tfoot>
                <tr>
                  <th colSpan={5}>Total ({businessCurrency})</th>
                  <th className="numeric">{formatCad(totals.expenses)}</th>
                  <th className="numeric">{formatCad(totals.revenue)}</th>
                  <th className="numeric">{formatCad(totals.profit)}</th>
                  <th colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
          {loading && <p className="empty-state">Loading commissions…</p>}
          {!loading && !error && commissions.length === 0 && <p className="empty-state">No commissions yet. Add one to start tracking custom requests.</p>}
        </div>
      </section>

      {formState && (
        <CommissionForm
          commission={typeof formState === 'object' ? formState.commission : undefined}
          rates={rates}
          defaultCurrency={businessCurrency}
          onCancel={() => setFormState(null)}
          onSubmit={save}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'single' ? 'Delete commission?' : 'Delete commissions?'}
          message={deleteTarget.kind === 'single'
            ? `Delete the commission for ${deleteTarget.commission.name}?`
            : `Delete ${deleteTarget.ids.length} selected commission(s)?`}
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

function SummaryCard({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return <article className="summary-panel"><span>{label}</span><strong className={negative ? 'negative' : undefined}>{value}</strong></article>;
}

function CommissionForm({
  commission,
  rates,
  defaultCurrency,
  onCancel,
  onSubmit,
}: {
  commission?: Commission;
  rates: ReturnType<typeof useReportingCurrency>['rates'];
  defaultCurrency: string;
  onCancel: () => void;
  onSubmit: (input: CommissionInput) => Promise<void>;
}) {
  const [name, setName] = useState(commission?.name ?? '');
  const [contact, setContact] = useState(commission?.contact ?? '');
  const [request, setRequest] = useState(commission?.request ?? '');
  const [deadline, setDeadline] = useState(commission?.deadline ?? '');
  const [currency, setCurrency] = useState(commission?.currency ?? defaultCurrency);
  const [expenses, setExpenses] = useState(centsToInputValue(commission?.expensesCents ?? 0));
  const [revenue, setRevenue] = useState(centsToInputValue(commission?.revenueCents ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const expensesCents = parseDollarsToCents(expenses);
  const revenueCents = parseDollarsToCents(revenue);
  const profitCents = expensesCents !== null && revenueCents !== null ? revenueCents - expensesCents : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedExpenses = parseDollarsToCents(expenses);
    const parsedRevenue = parseDollarsToCents(revenue);
    if (!name.trim()) return setError('Enter a name');
    if (name.length > 120 || contact.length > 120 || request.length > 200) return setError('One or more fields exceed the allowed length');
    if (parsedExpenses === null || parsedRevenue === null || parsedExpenses > MAX_AMOUNT_CENTS || parsedRevenue > MAX_AMOUNT_CENTS) {
      return setError(`Enter expense and revenue amounts between 0.00 and ${MAX_AMOUNT_DISPLAY}`);
    }
    if (!rates?.cadPerUnit[currency]) return setError(`No exchange rate is available for ${currency}`);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        contact: contact.trim(),
        request: request.trim(),
        deadline: deadline || null,
        currency,
        expensesCents: parsedExpenses,
        revenueCents: parsedRevenue,
      });
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={commission ? 'Edit commission' : 'Add commission'}
      onClose={onCancel}
      footer={<><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" form="commission-form" className="button" disabled={submitting}>{submitting ? 'Saving…' : 'Save commission'}</button></>}
    >
      <form id="commission-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <FormField id="commission-name" label="Name" required><input id="commission-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></FormField>
        <FormField id="commission-contact" label="Contact"><input id="commission-contact" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={120} placeholder="Email or phone" /></FormField>
        <FormField id="commission-request" label="Request"><input id="commission-request" value={request} onChange={(event) => setRequest(event.target.value)} maxLength={200} placeholder="What was requested?" /></FormField>
        <FormField id="commission-deadline" label="Deadline"><input id="commission-deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></FormField>
        <FormField id="commission-currency" label="Currency">
          <select id="commission-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {(rates?.currencies ?? []).map(({ code, name }) => (
              <option key={code} value={code} disabled={!rates?.cadPerUnit[code]}>{code} — {name}</option>
            ))}
          </select>
        </FormField>
        <FormField id="commission-expenses" label={`Expenses (${currency})`}><input id="commission-expenses" type="number" min="0" step="0.01" value={expenses} onChange={(event) => setExpenses(event.target.value)} /></FormField>
        <FormField id="commission-revenue" label={`Revenue (${currency})`}><input id="commission-revenue" type="number" min="0" step="0.01" value={revenue} onChange={(event) => setRevenue(event.target.value)} /></FormField>
        <FormField id="commission-profit" label="Profit (calculated)"><span id="commission-profit" className="form-row__static">{profitCents === null ? '—' : formatCentsIn(profitCents, currency)}</span></FormField>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

function FormField({ id, label, required, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
  return <div className="form-row"><label htmlFor={id}>{label}{required && <span className="required-marker" aria-hidden="true"> *</span>}</label><div className="form-row__control">{children}</div></div>;
}
