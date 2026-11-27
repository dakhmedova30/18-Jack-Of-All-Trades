import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import { testItem } from '../test/fixtures';
import {
  csvId,
  EXPENSE_CSV_HEADERS,
  expenseCsvRow,
  expenseInputFromCsv,
  importItemFromCsv,
  itemCsvRow,
  itemInputFromCsv,
  SALE_CSV_HEADERS,
  saleCsvRow,
  saleInputFromCsv,
  upsertFromCsv,
} from './businessCsv';
import { encodeCsv, parseCsv } from './csv';
import type { Expense, Sale } from '../types';

const itemRow = {
  id: '1',
  name: 'Tea',
  quantity: '15',
  unitPriceCents: '450',
  tags: '["Drinks"]',
  note: '',
  isPublic: 'false',
};

describe('business CSV mappings', () => {
  it('maps inventory rows and rejects invalid values', () => {
    expect(itemCsvRow(testItem).slice(0, 4)).toEqual([1, 'Tea', 12, 450]);
    expect(itemInputFromCsv(itemRow)).toEqual({
      name: 'Tea',
      quantity: 15,
      unitPriceCents: 450,
      tags: ['Drinks'],
      note: '',
      isPublic: false,
    });
    expect(() => itemInputFromCsv({ ...itemRow, tags: '[1]' })).toThrow('tags');
    expect(() => itemInputFromCsv({ ...itemRow, isPublic: 'yes' })).toThrow('isPublic');
    expect(() => csvId({ id: '-2' })).toThrow('id must be');
  });

  it('maps sale and expense lines, rejecting invalid line objects', () => {
    const sale = {
      soldAt: '2026-01-01T00:00:00Z',
      channelId: '4',
      description: 'Sale',
      tags: '["art"]',
      items: '[{"itemId":2,"quantity":3}]',
    };
    expect(saleInputFromCsv(sale)).toEqual({
      ...sale,
      channelId: 4,
      tags: ['art'],
      items: [{ itemId: 2, quantity: 3 }],
    });
    expect(() => saleInputFromCsv({ ...sale, items: '[{"itemId":2,"quantity":0}]' })).toThrow(
      'items',
    );
    const expense = {
      incurredAt: '2026-01-01T00:00:00Z',
      description: 'Rent',
      tags: '[]',
      items: '[{"itemId":null,"description":"Rent","quantity":1,"unitCostCents":500}]',
    };
    expect(expenseInputFromCsv(expense).items).toEqual([
      { itemId: null, description: 'Rent', quantity: 1, unitCostCents: 500 },
    ]);
    expect(() => expenseInputFromCsv({ ...expense, items: '[{"itemId":null}]' })).toThrow('items');
  });

  it('exports sale and expense lines in the form their import mappers accept', () => {
    const sale: Sale = {
      id: 8,
      soldAt: '2026-01-01T00:00:00Z',
      channel: { id: 4, name: 'Online' },
      description: 'Sale',
      tags: ['art'],
      totalCents: 500,
      currency: 'CAD',
      originalAmount: 5,
      originalCurrency: 'CAD',
      items: [
        {
          id: 1,
          itemId: 2,
          itemName: 'Tea',
          quantity: 1,
          unitPriceCents: 500,
          totalCents: 500,
          kind: 'ITEM',
          isFree: false,
          isTrade: false,
          discountId: null,
        },
      ],
      marketId: null,
      commissionId: null,
      miscId: null,
      createdAt: '',
      updatedAt: '',
    };
    const expense: Expense = {
      id: 9,
      incurredAt: sale.soldAt,
      description: 'Rent',
      tags: ['cost'],
      totalCents: 500,
      currency: 'CAD',
      originalAmount: 5,
      originalCurrency: 'CAD',
      items: [
        {
          id: 1,
          itemId: null,
          itemName: 'Rent',
          quantity: 1,
          unitCostCents: 500,
          totalCents: 500,
          category: '',
          subcategory: '',
          manufacturer: '',
          type: 'other',
        },
      ],
      createdAt: '',
      updatedAt: '',
    };
    const saleRow = saleCsvRow(sale);
    const expenseRow = expenseCsvRow(expense);
    expect(
      saleInputFromCsv(parseCsv(encodeCsv(SALE_CSV_HEADERS, [saleRow])).records[0]).items,
    ).toEqual([{ itemId: 2, quantity: 1 }]);
    const groupedRow = saleCsvRow({ ...sale, marketId: 1 });
    const groupedRecord = parseCsv(encodeCsv(SALE_CSV_HEADERS, [groupedRow])).records[0];
    expect(() => saleInputFromCsv(groupedRecord)).toThrow(
      'details that CSV import cannot preserve',
    );
    expect(
      expenseInputFromCsv(parseCsv(encodeCsv(EXPENSE_CSV_HEADERS, [expenseRow])).records[0]).items,
    ).toEqual([
      {
        itemId: null,
        description: 'Rent',
        quantity: 1,
        unitCostCents: 500,
        category: '',
        subcategory: '',
        manufacturer: '',
        type: 'other',
      },
    ]);
  });
});

describe('CSV upsert', () => {
  it('updates existing records, creates missing IDs, and propagates other errors', async () => {
    const create = vi.fn().mockResolvedValue({});
    const update = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ApiError(404, 'Not found'));
    expect(await upsertFromCsv(5, update, create)).toBe('updated');
    expect(await upsertFromCsv(6, update, create)).toBe('created');
    expect(await upsertFromCsv(undefined, update, create)).toBe('created');
    expect(create).toHaveBeenCalledTimes(2);
    update.mockRejectedValueOnce(new ApiError(403, 'Forbidden'));
    await expect(upsertFromCsv(7, update, create)).rejects.toThrow('Forbidden');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('preserves current stock on update and uses CSV stock for missing or new items', async () => {
    let stock = 13;
    const update = vi.fn(async (_id: number, input: { quantity?: number }) => {
      if (input.quantity !== undefined) stock = input.quantity;
    });
    const create = vi.fn().mockResolvedValue({});
    expect(await importItemFromCsv(itemRow, update, create)).toBe('updated');
    expect(stock).toBe(13);
    expect(update.mock.calls[0][1]).not.toHaveProperty('quantity');
    const missing = vi.fn().mockRejectedValue(new ApiError(404, 'Not found'));
    expect(await importItemFromCsv(itemRow, missing, create)).toBe('created');
    expect(await importItemFromCsv({ ...itemRow, id: '' }, update, create)).toBe('created');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ quantity: 15 }));
  });
});
