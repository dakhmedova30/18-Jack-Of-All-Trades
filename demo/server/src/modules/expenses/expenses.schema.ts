import { z } from 'zod';
import { MAX_INT, paginationQuerySchema } from '../../utils/pagination.js';

const tagSchema = z.string().trim().min(1, 'Tags cannot be empty').max(30);

// A line either restocks an inventory item (itemId set) or is a free-text cost
// (description set, e.g. "Rent"). Exactly one of the two must be given.
const expenseLineItemSchema = z
  .object({
    itemId: z.number().int().positive().max(MAX_INT).nullable().default(null),
    description: z.string().trim().max(120).default(''),
    quantity: z.number().int().positive().max(MAX_INT),
    unitCostCents: z.number().int().min(0, 'Cost cannot be negative').max(MAX_INT),
  })
  .refine((line) => line.itemId !== null || line.description !== '', {
    message: 'Pick an item or enter a description',
    path: ['description'],
  });

const expenseFields = {
  incurredAt: z.iso.datetime({ offset: true }),
  // Blank means "describe it from the lines" (see utils/describeLines).
  description: z.string().trim().max(200).default(''),
  tags: z
    .array(tagSchema)
    .max(10, 'At most 10 tags')
    .transform((tags) => [...new Set(tags)]),
  items: z
    .array(expenseLineItemSchema)
    .min(1, 'An expense needs at least one line')
    .max(50, 'At most 50 line items'),
};

// Omitting tags means "no tags" on both create and update.
const expenseFieldsWithTagsDefault = { ...expenseFields, tags: expenseFields.tags.default([]) };

export const createExpenseSchema = z.object(expenseFieldsWithTagsDefault);

// Editing an expense replaces its whole line-item list (see
// expenses.repository#replace), so soldAt/items are required; only tags defaults.
export const updateExpenseSchema = z.object(expenseFieldsWithTagsDefault);

export const EXPENSE_SORT_FIELDS = ['id', 'incurredAt', 'total', 'tags'] as const;
export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number];

export const listExpensesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  /** Defaults to newest expense first, the order the list always had. */
  sort: z.enum(EXPENSE_SORT_FIELDS).default('incurredAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkDeleteExpensesSchema = z.object({
  ids: z
    .array(z.number().int().positive().max(MAX_INT))
    .min(1, 'Select at least one expense')
    .max(100),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
