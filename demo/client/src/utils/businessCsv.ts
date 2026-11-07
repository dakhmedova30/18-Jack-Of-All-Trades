import type { Expense, ExpenseInput, Item, ItemInput, Sale, SaleInput } from '../types';
import {
  csvInteger,
  csvJsonArray,
  csvStringArray,
  type CsvRecord,
} from './csv';

export const ITEM_CSV_HEADERS = [
  'id', 'name', 'quantity', 'unitPriceCents', 'currency', 'originalPrice',
  'originalCurrency', 'tags', 'note', 'isPublic', 'createdAt', 'updatedAt',
];
export const ITEM_IMPORT_HEADERS = ['name', 'quantity', 'unitPriceCents', 'tags', 'note', 'isPublic'];

export const SALE_CSV_HEADERS = [
  'id', 'soldAt', 'channelId', 'channelName', 'description', 'tags', 'totalCents',
  'currency', 'originalAmount', 'originalCurrency', 'items', 'createdAt', 'updatedAt',
];
export const SALE_IMPORT_HEADERS = ['soldAt', 'channelId', 'description', 'tags', 'items'];

export const EXPENSE_CSV_HEADERS = [
  'id', 'incurredAt', 'description', 'tags', 'totalCents', 'currency', 'originalAmount',
  'originalCurrency', 'items', 'createdAt', 'updatedAt',
];
export const EXPENSE_IMPORT_HEADERS = ['incurredAt', 'description', 'tags', 'items'];

export function itemCsvRow(item: Item): Array<string | number | boolean | null> {
  return [
    item.id, item.name, item.quantity, item.unitPriceCents, item.currency, item.originalPrice,
    item.originalCurrency, JSON.stringify(item.tags), item.note, item.isPublic, item.createdAt,
    item.updatedAt,
  ];
}

export function saleCsvRow(sale: Sale): Array<string | number | boolean | null> {
  return [
    sale.id, sale.soldAt, sale.channel?.id ?? '', sale.channel?.name ?? '', sale.description,
    JSON.stringify(sale.tags), sale.totalCents, sale.currency, sale.originalAmount,
    sale.originalCurrency,
    JSON.stringify(sale.items.map(({ itemId, quantity }) => ({ itemId, quantity }))),
    sale.createdAt, sale.updatedAt,
  ];
}

export function expenseCsvRow(expense: Expense): Array<string | number | boolean | null> {
  return [
    expense.id, expense.incurredAt, expense.description, JSON.stringify(expense.tags),
    expense.totalCents, expense.currency, expense.originalAmount, expense.originalCurrency,
    JSON.stringify(expense.items.map((item) => ({
      itemId: item.itemId,
      description: item.itemId === null ? item.itemName : '',
      quantity: item.quantity,
      unitCostCents: item.unitCostCents,
    }))),
    expense.createdAt, expense.updatedAt,
  ];
}

export function csvId(record: CsvRecord): number | undefined {
  const text = record.id?.trim() ?? '';
  if (!text) return undefined;
  const id = Number(text);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('id must be a positive whole number.');
  return id;
}

export function itemInputFromCsv(record: CsvRecord): ItemInput {
  return {
    name: requiredText(record, 'name'),
    quantity: csvInteger(record, 'quantity'),
    unitPriceCents: csvInteger(record, 'unitPriceCents'),
    tags: csvStringArray(record, 'tags'),
    note: record.note ?? '',
    isPublic: csvBoolean(record, 'isPublic'),
  };
}

export function saleInputFromCsv(record: CsvRecord): SaleInput {
  return {
    soldAt: requiredText(record, 'soldAt'),
    channelId: csvInteger(record, 'channelId'),
    description: record.description ?? '',
    tags: csvStringArray(record, 'tags'),
    items: csvJsonArray(record, 'items', isSaleItem),
  };
}

export function expenseInputFromCsv(record: CsvRecord): ExpenseInput {
  return {
    incurredAt: requiredText(record, 'incurredAt'),
    description: record.description ?? '',
    tags: csvStringArray(record, 'tags'),
    items: csvJsonArray(record, 'items', isExpenseItem),
  };
}

function requiredText(record: CsvRecord, column: string): string {
  const value = record[column]?.trim() ?? '';
  if (!value) throw new Error(`${column} is required.`);
  return value;
}

function csvBoolean(record: CsvRecord, column: string): boolean {
  const value = record[column]?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${column} must be true or false.`);
}

function isSaleItem(value: unknown): value is SaleInput['items'][number] {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  return Number.isSafeInteger(line.itemId) && Number(line.itemId) > 0
    && Number.isSafeInteger(line.quantity) && Number(line.quantity) > 0;
}

function isExpenseItem(value: unknown): value is ExpenseInput['items'][number] {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  return (line.itemId === null || (Number.isSafeInteger(line.itemId) && Number(line.itemId) > 0))
    && typeof line.description === 'string'
    && Number.isSafeInteger(line.quantity) && Number(line.quantity) > 0
    && Number.isSafeInteger(line.unitCostCents) && Number(line.unitCostCents) >= 0;
}
