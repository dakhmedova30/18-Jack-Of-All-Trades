/** Item as returned by the API (camelCase, ISO timestamps). */
export interface Item {
  id: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

/** Item as stored in Postgres. */
export interface ItemRow {
  id: number;
  name: string;
  quantity: number;
  unit_price_cents: number;
  tags: string[];
  note: string;
  created_at: Date;
  updated_at: Date;
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    tags: row.tags,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
