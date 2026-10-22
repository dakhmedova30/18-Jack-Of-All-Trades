import { z } from 'zod';
import { MAX_INT, paginationQuerySchema } from '../../utils/pagination.js';

const tagSchema = z.string().trim().min(1, 'Tags cannot be empty').max(30);

const saleLineItemSchema = z.object({
  itemId: z.number().int().positive().max(MAX_INT),
  quantity: z.number().int().positive().max(MAX_INT),
});

const saleFields = {
  soldAt: z.iso.datetime({ offset: true }),
  channelId: z.number().int().positive().max(MAX_INT),
  // Blank means "describe it from the items" (see sales.service#describeLines).
  description: z.string().trim().max(200).default(''),
  tags: z
    .array(tagSchema)
    .max(10, 'At most 10 tags')
    .transform((tags) => [...new Set(tags)]),
  items: z
    .array(saleLineItemSchema)
    .min(1, 'A sale needs at least one item')
    .max(50, 'At most 50 line items'),
};

// Omitting tags means "no tags" on both create and update.
const saleFieldsWithTagsDefault = { ...saleFields, tags: saleFields.tags.default([]) };

export const createSaleSchema = z.object(saleFieldsWithTagsDefault);

// Editing a sale replaces its whole item list (see sales.repository#replace),
// so, unlike items, soldAt and items are required; only tags defaults.
export const updateSaleSchema = z.object(saleFieldsWithTagsDefault);

export const SALE_SORT_FIELDS = ['id', 'soldAt', 'total', 'tags', 'channel'] as const;
export type SaleSortField = (typeof SALE_SORT_FIELDS)[number];

export const listSalesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  /** Defaults to newest sale first, the order the list always had. */
  sort: z.enum(SALE_SORT_FIELDS).default('soldAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkDeleteSalesSchema = z.object({
  ids: z
    .array(z.number().int().positive().max(MAX_INT))
    .min(1, 'Select at least one sale')
    .max(100),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
