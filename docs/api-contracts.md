# API Contracts (D2)

The JSON contract between the React client and the backend. It documents **what the TypeScript demo implements**, as it will work once its open branches are merged:

| Branch | Adds | Merged into `claude-demo`? |
| --- | --- | --- |
| `claude-demo` | Items, Sales, Expenses, Analytics `summary` | — (base) |
| `implement-user-login` | Accounts, sessions, all data scoped by `business_id` | Not yet |
| `merge-ui-mods` | Sorting, `insights`, `low-stock`, `month-summary`, `month-breakdown`, Analytics `inventory` | Not yet |

Each section notes its source branch. Gaps the D2 user stories still need are listed in §8, and a known merge risk is in §9. Source files: `demo/server/src/modules/*/…routes.ts` and `demo/client/src/types.ts`.

## 1. Rules for every endpoint

- **Base path:** `/api`. Every endpoint except `/api/health` and `/api/auth/*` requires login; without a valid session → `401 "Log in to continue"`.
- **Ownership:** each business only sees and changes its own data. Another business's id behaves like a nonexistent one (`404`, or `400 "Item 7 does not exist"` when referenced in a request body).
- **JSON:** camelCase field names. Money is **integer cents** in fields ending in `Cents` (`1200` = $12.00). Timestamps are ISO-8601 strings; ids are numbers.
- **Status codes:** `POST` creates → `201`; `DELETE` → `204` with an empty body.
- **"This month"** in the summary endpoints means the current **UTC** calendar month, as a `[periodStart, periodEnd)` range.

### Lists

Query parameters: `page` (≥ 1, default 1), `pageSize` (1–100, default 10), `search` (optional, ≤ 100 characters), plus `sort` and `order` where noted.

```json
{ "data": [], "page": 1, "pageSize": 10, "total": 42, "totalPages": 5 }
```

`totalPages` is at least 1, even when there are no results.

### Errors

Every error response has this shape:

```json
{
  "error": {
    "message": "Validation failed",
    "details": [{ "field": "quantity", "message": "Quantity cannot be negative" }]
  }
}
```

`details` is present only for validation errors. `field` is the path of the bad input, with dots between parts; a sale's second line's quantity is `items.1.quantity`.

| Status | When |
| --- | --- |
| `400` | Invalid input, malformed JSON, not enough stock, referenced item doesn't exist, email already registered |
| `401` | Not logged in, or incorrect email or password |
| `404` | Resource or route not found (including another business's id) |
| `503` | Database unavailable |
| `500` | Unexpected error (details are logged, never sent) |

## 2. Accounts: `/api/auth`

*Source: `implement-user-login`.*

One account is one business. Login sets a `jack_session` cookie that the browser sends automatically; there is no token to store.

| Method | Path | Request body | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `RegisterInput` | `201` `Business`; logged in | `400` (including `An account with that email already exists`) |
| `POST` | `/api/auth/login` | `LoginInput` | `200` `Business`; logged in | `401` `Incorrect email or password` |
| `POST` | `/api/auth/logout` | — | `204`; cookie cleared | — |
| `GET` | `/api/auth/me` | — | `200` `Business` | `401` `Not logged in` |

```json
// Business
{ "id": 1, "name": "Demo Business", "email": "demo@jackofalltrades.test", "createdAt": "2026-10-21T22:00:00.000Z" }

// RegisterInput
{ "name": "Allie's Prints", "email": "allie@example.com", "password": "correct-horse" }

// LoginInput
{ "email": "allie@example.com", "password": "correct-horse" }
```

| Field | Rules |
| --- | --- |
| `name` | Business name; required; 1–120 characters, trimmed |
| `email` | Required; valid address; ≤ 255 characters; trimmed and lowercased |
| `password` | Register: 8–200 characters. Login: 1–200 characters |

**Session:** stored in the database (`sessions` table) and valid for **30 days**. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS. There is no separate CSRF token; `SameSite=Lax` keeps other sites from sending requests with the cookie.

**Client flow:** on startup, call `GET /api/auth/me`: `200` → show the app; `401` → show the login page. Any later `401` → go to the login page.

**Demo account** (created by the seeder): `demo@jackofalltrades.test` / `ChangeMe123!`.

## 3. Inventory: `/api/items` (US2)

*Source: `claude-demo`; sorting, `insights` and `low-stock` from `merge-ui-mods`.*

| Method | Path | Request body | Success |
| --- | --- | --- | --- |
| `GET` | `/api/items?page&pageSize&search&sort&order` | — | `200` `Paginated<Item>` |
| `GET` | `/api/items/insights` | — | `200` `InventoryInsights` |
| `GET` | `/api/items/low-stock?limit` | — | `200` `LowStock` |
| `GET` | `/api/items/{id}` | — | `200` `Item` |
| `POST` | `/api/items` | `ItemInput` | `201` `Item` |
| `PATCH` | `/api/items/{id}` | Partial `ItemInput` (at least one field) | `200` `Item` |
| `DELETE` | `/api/items/{id}` | — | `204` |
| `POST` | `/api/items/bulk-delete` | `{ "ids": [1, 2] }` (1–100 ids) | `200` `{ "deleted": 2 }` |

- **List:** `search` matches the name or tags, case-insensitive. `sort` is `id` (default), `name`, `quantity` or `unitPriceCents`; `order` is `asc` (default) or `desc`.
- **`low-stock`:** items with quantity **≤ 5**. `limit` is 1–100 (default 5) and only caps the list; `count` covers every low item.

```json
// Item
{
  "id": 7, "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200,
  "tags": ["print"], "note": "",
  "createdAt": "2026-10-19T20:00:00.000Z", "updatedAt": "2026-10-19T20:00:00.000Z"
}

// ItemInput
{ "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200, "tags": ["print"], "note": "" }

// InventoryInsights: stock value at selling price, and this month's top 3 sellers
{
  "stockValueCents": 482000, "totalUnits": 310,
  "periodStart": "2026-10-01T00:00:00.000Z", "periodEnd": "2026-11-01T00:00:00.000Z",
  "bestSellers": [{ "id": 7, "name": "Flower Print", "unitsSold": 14, "revenueCents": 16800 }]
}

// LowStock
{ "count": 3, "threshold": 5, "items": [{ "id": 9, "name": "Flower Keychain", "quantity": 1 }] }
```

| `ItemInput` field | Rules |
| --- | --- |
| `name` | Required on create; 1–120 characters, trimmed |
| `quantity` | Required on create; whole number ≥ 0 |
| `unitPriceCents` | Required on create; whole number ≥ 0 |
| `tags` | Optional; ≤ 10 tags, each 1–30 characters; duplicates removed; default `[]` |
| `note` | Optional; ≤ 1000 characters; default `""` |

Deleting an item doesn't change past sales or expenses: their lines keep the item's name, and `itemId` becomes `null`.

## 4. Sales: `/api/sales` (US1)

*Source: `claude-demo`; sorting and `month-summary` from `merge-ui-mods`.*

| Method | Path | Request body | Success |
| --- | --- | --- | --- |
| `GET` | `/api/sales?page&pageSize&search&sort&order` | — | `200` `Paginated<Sale>` |
| `GET` | `/api/sales/month-summary` | — | `200` `SalesMonthSummary` |
| `GET` | `/api/sales/{id}` | — | `200` `Sale` |
| `POST` | `/api/sales` | `SaleInput` | `201` `Sale` |
| `PATCH` | `/api/sales/{id}` | `SaleInput`: **replaces** the whole sale, including all lines | `200` `Sale` |
| `DELETE` | `/api/sales/{id}` | — | `204` |
| `POST` | `/api/sales/bulk-delete` | `{ "ids": [1, 2] }` (1–100 ids) | `200` `{ "deleted": 2 }` |

- **List:** `search` matches tags or item names on the sale's lines. `sort` is `soldAt` (default), `id`, `total` or `tags`; `order` is `desc` (default) or `asc`.

```json
// Sale
{
  "id": 42,
  "soldAt": "2026-10-18T19:30:00.000Z",
  "tags": ["market"],
  "totalCents": 3500,
  "items": [
    { "id": 101, "itemId": 7, "itemName": "Flower Print", "quantity": 2, "unitPriceCents": 1200, "totalCents": 2400 },
    { "id": 102, "itemId": 9, "itemName": "Flower Keychain", "quantity": 1, "unitPriceCents": 1100, "totalCents": 1100 }
  ],
  "createdAt": "2026-10-18T19:31:02.000Z",
  "updatedAt": "2026-10-18T19:31:02.000Z"
}

// SaleInput
{ "soldAt": "2026-10-18T15:30:00-04:00", "tags": ["market"], "items": [{ "itemId": 7, "quantity": 2 }, { "itemId": 9, "quantity": 1 }] }

// SalesMonthSummary
{
  "periodStart": "2026-10-01T00:00:00.000Z", "periodEnd": "2026-11-01T00:00:00.000Z",
  "saleCount": 41, "revenueCents": 95000, "averageSaleCents": 2317,
  "largestSale": { "id": 42, "soldAt": "2026-10-18T19:30:00.000Z", "totalCents": 8800 }
}
```

| `SaleInput` field | Rules |
| --- | --- |
| `soldAt` | Required; ISO-8601 timestamp with an offset |
| `tags` | As for items; default `[]` |
| `items` | 1–50 lines; each `itemId` must be one of your items; `quantity` ≥ 1 |

**Behavior:**
- Each line's price is the item's **current** `unitPriceCents`, copied into the sale. Later price changes don't affect past sales.
- `totalCents` (line and sale) is calculated by the server.
- Recording a sale decreases stock; editing restores the old lines and applies the new ones; deleting restores stock.
- Not enough stock → `400 Not enough stock for "Flower Print" (have 1, need 2)`, and nothing is saved.
- `largestSale` is `null` in a month with no sales; `averageSaleCents` is then `0`.

## 5. Expenses: `/api/expenses`

*Source: `claude-demo`; sorting and `month-breakdown` from `merge-ui-mods`.*

Same endpoints as Sales, with `GET /api/expenses/month-breakdown` in place of `month-summary`. `sort` is `incurredAt` (default), `id`, `total` or `tags`; `order` is `desc` (default) or `asc`.

```json
// Expense
{
  "id": 5,
  "incurredAt": "2026-10-10T12:00:00.000Z",
  "tags": ["supplies"],
  "totalCents": 17500,
  "items": [
    { "id": 11, "itemId": 7, "itemName": "Flower Print", "quantity": 200, "unitCostCents": 75, "totalCents": 15000 },
    { "id": 12, "itemId": null, "itemName": "Shipping", "quantity": 1, "unitCostCents": 2500, "totalCents": 2500 }
  ],
  "createdAt": "2026-10-10T12:01:00.000Z",
  "updatedAt": "2026-10-10T12:01:00.000Z"
}

// ExpenseInput
{
  "incurredAt": "2026-10-10T08:00:00-04:00",
  "tags": ["supplies"],
  "items": [
    { "itemId": 7, "quantity": 200, "unitCostCents": 75 },
    { "itemId": null, "description": "Shipping", "quantity": 1, "unitCostCents": 2500 }
  ]
}

// ExpenseMonthBreakdown: restock spending vs running costs this month
{
  "periodStart": "2026-10-01T00:00:00.000Z", "periodEnd": "2026-11-01T00:00:00.000Z",
  "restockCents": 15000, "runningCents": 2500, "totalCents": 17500,
  "topRestockItems": [{ "id": 7, "name": "Flower Print", "units": 200, "spentCents": 15000 }]
}
```

| `ExpenseInput` field | Rules |
| --- | --- |
| `incurredAt` | Required; ISO-8601 timestamp with an offset |
| `tags` | As for items; default `[]` |
| `items` | 1–50 lines |
| line `itemId` | One of your items (**restocks** it), or `null`/omitted for a plain cost |
| line `description` | Required when `itemId` is `null`; ≤ 120 characters |
| line `quantity` | ≥ 1 |
| line `unitCostCents` | ≥ 0 |

**Behavior:**
- A restock line increases the item's stock.
- Editing or deleting an expense undoes its restocks first, and is rejected with `400` if that stock has already been sold.
- `topRestockItems` lists up to 5 items, most spent first.

## 6. Analytics: `/api/analytics` (US3)

*Source: `claude-demo`; `inventory` from `merge-ui-mods`.*

### `GET /api/analytics/summary?range`

One response drives the whole dashboard. `range` is the page's "Show by" filter:

| `range` | Period | Buckets |
| --- | --- | --- |
| `week` | The last 7 days | One per day, labelled `Mon`, `Tue`, … |
| `month` | Month to date | One per day so far, labelled `1`, `2`, … |
| `ytd` | Year to date | One per month, labelled `Jan`, `Feb`, … |
| `12months` (default) | The last 12 calendar months | One per month |

Revenue and expenses are grouped by each record's **first tag** (records without tags count as `"Untagged"`): the top 3 tags by value, with the rest combined as `"Other"`. Days and months are UTC.

```json
{
  "range": "12months",
  "granularity": "month",
  "buckets": ["2025-11", "2025-12", "2026-01"],
  "bucketLabels": ["Nov", "Dec", "Jan"],
  "totalRevenueCents": 95000,
  "totalExpensesCents": 12500,
  "netProfitCents": 82500,
  "revenueSeries": [
    { "label": "print", "values": [12000, 8000, 15000] },
    { "label": "Other", "values": [3000, 0, 2500] }
  ],
  "expenseSeries": [
    { "label": "supplies", "values": [5000, 0, 7500] }
  ],
  "salesByTag": [
    { "label": "print", "valueCents": 35000 },
    { "label": "Other", "valueCents": 5500 }
  ]
}
```

- `buckets` are `YYYY-MM` (monthly) or `YYYY-MM-DD` (daily), oldest first. Each series' `values` line up with `buckets`.
- The totals cover the selected range, not all time. `netProfitCents` = `totalRevenueCents − totalExpensesCents`.
- A series appears only if it has at least one record in the range.

### `GET /api/analytics/inventory`

Current stock grouped by first tag. It's a snapshot, so `range` doesn't apply. Tags past the top 7 are combined as `"Other"`, listed last.

```json
{
  "byTag": [{ "label": "print", "quantity": 180, "itemCount": 6 }, { "label": "Other", "quantity": 20, "itemCount": 3 }],
  "totalQuantity": 310,
  "totalItems": 22
}
```

## 7. Health: `/api/health`

No login required. `200 { "status": "ok", "database": "ok" }` when the database responds.

## 8. Not implemented yet

What the D2 user stories ask for that no branch implements:

| Story | Missing | Suggested addition |
| --- | --- | --- |
| **US1:** "log a sale with an amount, date, product, and **sales channel**" | No `channel` on sales | Required `channel` on `Sale` and `SaleInput` (e.g. `IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC`), and a `channel` list filter |
| **US3:** "charts showcasing the **number of sales** over time, and number of sales **per item**" | `summary` charts revenue **dollars** by **tag**; there's no sales count over time and no per-item breakdown. `bestSellers` only covers the current month's top 3. | Add sale counts to the time series, and a per-item breakdown for the selected range |
| — | Days and months use UTC, so evening sales in Toronto count toward the next day | Optional: bucket by `America/Toronto` |

## 9. Merge note

`merge-ui-mods` was written before login existed, so its new endpoints (`/items/insights`, `/items/low-stock`, `/sales/month-summary`, `/expenses/month-breakdown`, `/analytics/inventory`) don't filter by business. **Whoever merges second must add `business_id` scoping to those queries**, or they will return every business's data.
