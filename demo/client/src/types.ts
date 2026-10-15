// Mirrors the API response shapes in server/src/modules/*.

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

export type ItemInput = Pick<Item, 'name' | 'quantity' | 'unitPriceCents' | 'tags' | 'note'>;

export interface SaleItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Sale {
  id: number;
  soldAt: string;
  tags: string[];
  totalCents: number;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleLineItemInput {
  itemId: number;
  quantity: number;
}

export interface SaleInput {
  soldAt: string;
  tags: string[];
  items: SaleLineItemInput[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
