import { z } from 'zod';
import { MAX_INT, paginationQuerySchema } from '../../utils/pagination.js';

const tagSchema = z.string().trim().min(1, 'Tags cannot be empty').max(30);

// Defaults are deliberately NOT set here: the update schema reuses these fields
// and must leave omitted fields untouched rather than resetting them.
const itemFields = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative')
    .max(MAX_INT),
  unitPriceCents: z
    .number()
    .int('Price must be in whole cents')
    .min(0, 'Price cannot be negative')
    .max(MAX_INT),
  tags: z
    .array(tagSchema)
    .max(10, 'At most 10 tags')
    .transform((tags) => [...new Set(tags)]),
  note: z.string().max(1000),
};

export const createItemSchema = z.object({
  ...itemFields,
  tags: itemFields.tags.default([]),
  note: itemFields.note.default(''),
});

export const updateItemSchema = z
  .object(itemFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Provide at least one field to update',
  });

export const ITEM_SORT_FIELDS = ['id', 'name', 'quantity', 'unitPriceCents'] as const;
export type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];

export const listItemsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  /** Column to sort by; defaults to id ascending, the order the list always had. */
  sort: z.enum(ITEM_SORT_FIELDS).default('id'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const lowStockQuerySchema = z.object({
  /** How many of the lowest items to list (the count always covers all of them). */
  limit: z.coerce.number().int().min(1).max(100).default(5),
});

export const bulkDeleteSchema = z.object({
  ids: z
    .array(z.number().int().positive().max(MAX_INT))
    .min(1, 'Select at least one item')
    .max(100),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
