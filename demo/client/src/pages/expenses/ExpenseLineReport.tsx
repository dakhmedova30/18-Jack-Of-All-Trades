import { useState, type ReactNode } from 'react';
import type { ExpenseLineReport } from '../../types';
import { formatCents } from '../../utils/money';

type ReportMode = 'category' | 'manufacturer';

interface ExpenseLineReportProps {
  lines: ExpenseLineReport[];
  mode: ReportMode;
  currency: string;
  formatDate: (date: string) => string;
  selectedIds: Set<number>;
  onToggleExpense: (id: number) => void;
  onOpenExpense: (id: number) => void;
}

function sum(lines: ExpenseLineReport[]) {
  return lines.reduce((total, line) => total + line.displayTotalCents, 0);
}

function expenseIds(lines: ExpenseLineReport[]) {
  return [...new Set(lines.map((line) => line.expenseId))];
}

export function ExpenseLineReportView({
  lines,
  mode,
  currency,
  formatDate,
  selectedIds,
  onToggleExpense,
  onOpenExpense,
}: ExpenseLineReportProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroup(ids: number[]) {
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    ids.forEach((id) => {
      if (selectedIds.has(id) === allSelected) onToggleExpense(id);
    });
  }

  const grandTotal = sum(lines);

  if (mode === 'category') {
    const categories = new Map<string, Map<string, ExpenseLineReport[]>>();
    for (const line of lines) {
      const category = line.category || '';
      const subcategory = line.subcategory || '';
      const bySubcategory = categories.get(category) ?? new Map<string, ExpenseLineReport[]>();
      const items = bySubcategory.get(subcategory) ?? [];
      items.push(line);
      bySubcategory.set(subcategory, items);
      categories.set(category, bySubcategory);
    }

    return (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Category / sub-category</th>
              <th>Lines</th>
              <th className="numeric">Subtotal ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {[...categories.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, subcategories]) => {
              const categoryLines = [...subcategories.values()].flat();
              const categoryKey = `category:${category}`;
              const categoryIds = expenseIds(categoryLines);
              const categoryOpen = expanded.has(categoryKey);
              return (
                <FragmentGroup key={categoryKey}>
                  <tr>
                    <td>
                      <input
                        type="checkbox"
                        checked={categoryIds.length > 0 && categoryIds.every((id) => selectedIds.has(id))}
                        onChange={() => toggleGroup(categoryIds)}
                        aria-label={`Select expenses in ${category || 'Uncategorized'}`}
                      />
                      <button type="button" className="link-button" aria-expanded={categoryOpen} onClick={() => toggle(categoryKey)}>
                        {categoryOpen ? '▾' : '▸'} {category || 'Uncategorized'}
                      </button>
                    </td>
                    <td>{categoryLines.length}</td>
                    <td className="numeric">{formatCents(sum(categoryLines), currency)}</td>
                  </tr>
                  {categoryOpen && [...subcategories.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([subcategory, subLines]) => {
                    const subcategoryKey = `${categoryKey}:subcategory:${subcategory}`;
                    const subcategoryIds = expenseIds(subLines);
                    const subcategoryOpen = expanded.has(subcategoryKey);
                    return (
                      <FragmentGroup key={subcategoryKey}>
                        <tr>
                          <td className="expense-report__subcategory">
                            <input
                              type="checkbox"
                              checked={subcategoryIds.length > 0 && subcategoryIds.every((id) => selectedIds.has(id))}
                              onChange={() => toggleGroup(subcategoryIds)}
                              aria-label={`Select expenses in ${subcategory || 'Uncategorized'}`}
                            />
                            <button type="button" className="link-button" aria-expanded={subcategoryOpen} onClick={() => toggle(subcategoryKey)}>
                              {subcategoryOpen ? '▾' : '▸'} {subcategory || 'Uncategorized'}
                            </button>
                          </td>
                          <td>{subLines.length}</td>
                          <td className="numeric">{formatCents(sum(subLines), currency)}</td>
                        </tr>
                        {subcategoryOpen && subLines.map((line) => (
                          <LineRow key={line.lineId} line={line} currency={currency} formatDate={formatDate} onOpenExpense={onOpenExpense} />
                        ))}
                      </FragmentGroup>
                    );
                  })}
                </FragmentGroup>
              );
            })}
          </tbody>
          <ReportFooter count={lines.length} total={grandTotal} currency={currency} />
        </table>
      </div>
    );
  }

  const manufacturers = new Map<string, ExpenseLineReport[]>();
  for (const line of lines) {
    const manufacturer = line.manufacturer || '';
    const items = manufacturers.get(manufacturer) ?? [];
    items.push(line);
    manufacturers.set(manufacturer, items);
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Manufacturer</th>
            <th>Lines</th>
            <th className="numeric">Subtotal ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {[...manufacturers.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([manufacturer, items]) => {
            const key = `manufacturer:${manufacturer}`;
            const ids = expenseIds(items);
            const isOpen = expanded.has(key);
            return (
              <FragmentGroup key={key}>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={ids.length > 0 && ids.every((id) => selectedIds.has(id))}
                      onChange={() => toggleGroup(ids)}
                      aria-label={`Select expenses from ${manufacturer || 'Unspecified manufacturer'}`}
                    />
                    <button type="button" className="link-button" aria-expanded={isOpen} onClick={() => toggle(key)}>
                      {isOpen ? '▾' : '▸'} {manufacturer || 'Unspecified manufacturer'}
                    </button>
                  </td>
                  <td>{items.length}</td>
                  <td className="numeric">{formatCents(sum(items), currency)}</td>
                </tr>
                {isOpen && items.map((line) => (
                  <LineRow key={line.lineId} line={line} currency={currency} formatDate={formatDate} onOpenExpense={onOpenExpense} />
                ))}
              </FragmentGroup>
            );
          })}
        </tbody>
        <ReportFooter count={lines.length} total={grandTotal} currency={currency} />
      </table>
    </div>
  );
}

function FragmentGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function LineRow({
  line,
  currency,
  formatDate,
  onOpenExpense,
}: {
  line: ExpenseLineReport;
  currency: string;
  formatDate: (date: string) => string;
  onOpenExpense: (id: number) => void;
}) {
  return (
    <tr>
      <td className="expense-report__line">
        <strong>{line.itemName}</strong> × {line.quantity}
        <span className="muted"> · {formatDate(line.incurredAt)}</span>
      </td>
      <td>
        {line.type} · {line.manufacturer || 'Unspecified manufacturer'} · {line.category || 'Uncategorized'}
        {line.subcategory ? ` / ${line.subcategory}` : ''}
      </td>
      <td className="numeric">
        {formatCents(line.displayTotalCents, currency)}
        {line.originalCurrency !== currency && (
          <span className="muted"> ({formatCents(line.totalCents, line.originalCurrency)})</span>
        )}
        {' · '}
        <button type="button" className="link-button" onClick={() => onOpenExpense(line.expenseId)}>
          Expense #{line.expenseId}
        </button>
      </td>
    </tr>
  );
}

function ReportFooter({ count, total, currency }: { count: number; total: number; currency: string }) {
  return (
    <tfoot>
      <tr>
        <th scope="row">Grand total</th>
        <td>{count} lines</td>
        <td className="numeric">{formatCents(total, currency)}</td>
      </tr>
    </tfoot>
  );
}
