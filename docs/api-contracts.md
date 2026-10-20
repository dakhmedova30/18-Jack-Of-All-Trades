# API Contracts (D2)

The JSON contract between the React client and the Java backend. Reasoning and implementation details are in [`backend-skeleton-design.md`](backend-skeleton-design.md); this file only defines requests and responses.

**Compatibility:** shapes match the TypeScript demo on `claude-demo` (`demo/client/src/types.ts`). Items and Expenses are unchanged. **New:** login (§2), `channel` on sales (§4), analytics (§6).

## 1. Rules for every endpoint

- **Base path:** `/api`. Every endpoint except `/api/health` and `/api/auth/*` requires login (`401` otherwise).
- **Ownership:** each account only sees and changes its own data. Another account's id behaves like a nonexistent one (`404`, or `400` when referenced inside a request body).
- **JSON:** camelCase field names. Money is **integer cents** in fields ending in `Cents` (`1200` = $12.00). Timestamps are ISO-8601 strings; ids are numbers.
- **Status codes:** `POST` creates → `201`; `DELETE` → `204` with an empty body.
- **CSRF:** every `POST`, `PATCH` and `DELETE` must send the header `X-XSRF-TOKEN`, set to the value of the `XSRF-TOKEN` cookie (§2). Otherwise → `403`.

### Lists

Query parameters: `page` (≥ 1, default 1), `pageSize` (1–100, default 10), `search` (optional, ≤ 100 characters).

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
    "details": [{ "field": "items[0].quantity", "message": "Quantity must be at least 1" }]
  }
}
```

`details` is present only for validation errors. `field` is the JSON path of the bad input.

| Status | When |
|---|---|
| `400` | Invalid input, malformed JSON, or not enough stock |
| `401` | Not logged in, or wrong email or password |
| `403` | Missing or invalid CSRF token |
| `404` | Resource or route not found (including another account's id) |
| `409` | Email already registered |
| `503` | Database unavailable |
| `500` | Unexpected error (details are logged, never sent) |

## 2. Accounts: `/api/auth`

Login creates a session cookie that the browser sends automatically. There is no token to store.

| Method | Path | Request body | Success | Errors |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | `SignupInput` | `201` `User`; the user is logged in | `400`, `409` |
| `POST` | `/api/auth/login` | `LoginInput` | `200` `User` | `401` `Invalid email or password` |
| `POST` | `/api/auth/logout` | — | `204` | — |
| `GET` | `/api/auth/me` | — | `200` `User` | `401` |

```json
// User
{ "id": 3, "email": "allie@example.com", "displayName": "Allie" }

// SignupInput
{ "email": "allie@example.com", "password": "correct-horse", "displayName": "Allie" }

// LoginInput
{ "email": "allie@example.com", "password": "correct-horse" }
```

| Field | Rules |
|---|---|
| `email` | Required, valid address, ≤ 254 characters, case-insensitive |
| `password` | Required, 8–72 characters |
| `displayName` | Optional, ≤ 60 characters, default `""` |

**Client flow:**
1. On startup, call `GET /api/auth/me`. `200` → show the app; `401` → show the login page.
2. Any later `401` → go to the login page.
3. Read the `XSRF-TOKEN` cookie and send it as the `X-XSRF-TOKEN` header on `POST`, `PATCH` and `DELETE`. `GET /api/auth/me` sets the cookie if it's missing.

## 3. Inventory: `/api/items` (US2)

Unchanged from the demo.

| Method | Path | Request body | Success |
|---|---|---|---|
| `GET` | `/api/items?page&pageSize&search` | — | `200` `Paginated<Item>` |
| `GET` | `/api/items/{id}` | — | `200` `Item` |
| `POST` | `/api/items` | `ItemInput` | `201` `Item` |
| `PATCH` | `/api/items/{id}` | Partial `ItemInput` (at least one field) | `200` `Item` |
| `DELETE` | `/api/items/{id}` | — | `204` |
| `POST` | `/api/items/bulk-delete` | `{ "ids": [1, 2] }` (1–100 ids) | `200` `{ "deleted": 2 }` |

The list is sorted by `id`, ascending. `search` matches the name or tags, case-insensitive.

```json
// Item
{
  "id": 7, "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200,
  "tags": ["print"], "note": "",
  "createdAt": "2026-10-19T20:00:00Z", "updatedAt": "2026-10-19T20:00:00Z"
}

// ItemInput
{ "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200, "tags": ["print"], "note": "" }
```

| Field | Rules |
|---|---|
| `name` | Required on create; 1–120 characters, trimmed |
| `quantity` | Required on create; whole number ≥ 0 |
| `unitPriceCents` | Required on create; whole number ≥ 0 |
| `tags` | Optional; ≤ 10 tags, each 1–30 characters; duplicates removed; default `[]` |
| `note` | Optional; ≤ 1000 characters; default `""` |

Deleting an item doesn't change past sales or expenses: their lines keep the item's name, and `itemId` becomes `null`.

## 4. Sales: `/api/sales` (US1)

As in the demo, plus the required **`channel`** field.

| Method | Path | Request body | Success |
|---|---|---|---|
| `GET` | `/api/sales?page&pageSize&search&channel` | — | `200` `Paginated<Sale>` |
| `GET` | `/api/sales/{id}` | — | `200` `Sale` |
| `POST` | `/api/sales` | `SaleInput` | `201` `Sale` |
| `PATCH` | `/api/sales/{id}` | `SaleInput`: **replaces** the whole sale, including all lines | `200` `Sale` |
| `DELETE` | `/api/sales/{id}` | — | `204` |
| `POST` | `/api/sales/bulk-delete` | `{ "ids": [1, 2] }` (1–100 ids) | `200` `{ "deleted": 2 }` |

The list is sorted by `soldAt`, newest first. `search` matches tags or item names on the sale's lines. `channel` filters to one channel.

```json
// Sale
{
  "id": 42,
  "soldAt": "2026-10-18T15:30:00Z",
  "channel": "IN_PERSON",
  "tags": [],
  "totalCents": 3500,
  "items": [
    { "id": 101, "itemId": 7, "itemName": "Flower Print", "quantity": 2, "unitPriceCents": 1200, "totalCents": 2400 },
    { "id": 102, "itemId": 9, "itemName": "Flower Keychain", "quantity": 1, "unitPriceCents": 1100, "totalCents": 1100 }
  ],
  "createdAt": "2026-10-18T15:31:02Z",
  "updatedAt": "2026-10-18T15:31:02Z"
}

// SaleInput
{
  "soldAt": "2026-10-18T15:30:00-04:00",
  "channel": "IN_PERSON",
  "tags": [],
  "items": [{ "itemId": 7, "quantity": 2 }, { "itemId": 9, "quantity": 1 }]
}
```

| Field | Rules |
|---|---|
| `soldAt` | Required; ISO-8601 timestamp with an offset |
| `channel` | **New, required.** One of `IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC` |
| `tags` | As for items |
| `items` | 1–50 lines; each `itemId` must be one of your items; `quantity` ≥ 1 |

**Behavior:**
- Each line's price is the item's **current** `unitPriceCents`, copied into the sale. Later price changes don't affect past sales.
- `totalCents` (line and sale) is calculated by the server.
- Recording a sale decreases stock; editing restores the old lines and applies the new ones; deleting restores stock.
- Not enough stock → `400`, e.g. `Not enough stock for "Flower Print" (have 1, need 2)`. Nothing is saved.

## 5. Expenses: `/api/expenses`

Unchanged from the demo. Same endpoints as Sales: list (`page`, `pageSize`, `search`; newest `incurredAt` first), get, `POST` → `201`, `PATCH` (replaces), `DELETE` → `204`, `POST /bulk-delete`.

```json
// Expense
{
  "id": 5,
  "incurredAt": "2026-10-10T12:00:00Z",
  "tags": ["supplies"],
  "totalCents": 17500,
  "items": [
    { "id": 11, "itemId": 7, "itemName": "Flower Print", "quantity": 200, "unitCostCents": 75, "totalCents": 15000 },
    { "id": 12, "itemId": null, "itemName": "Shipping", "quantity": 1, "unitCostCents": 2500, "totalCents": 2500 }
  ],
  "createdAt": "2026-10-10T12:01:00Z",
  "updatedAt": "2026-10-10T12:01:00Z"
}

// ExpenseInput
{
  "incurredAt": "2026-10-10T08:00:00-04:00",
  "tags": ["supplies"],
  "items": [
    { "itemId": 7, "description": "", "quantity": 200, "unitCostCents": 75 },
    { "itemId": null, "description": "Shipping", "quantity": 1, "unitCostCents": 2500 }
  ]
}
```

| Field | Rules |
|---|---|
| `incurredAt` | Required; ISO-8601 timestamp with an offset |
| `tags` | As for items |
| `items` | 1–50 lines |
| line `itemId` | One of your items (**restocks** it), or `null` for a plain cost |
| line `description` | Required when `itemId` is `null`; ≤ 120 characters |
| line `quantity` | ≥ 1 |
| line `unitCostCents` | ≥ 0 |

**Behavior:** a restock line increases the item's stock. Editing or deleting an expense undoes its restocks first, and is rejected with `400` if that stock has already been sold.

## 6. Analytics: `/api/analytics` (US3)

New. Read-only.

| Parameter | Default | Rules |
|---|---|---|
| `from` | 30 days before `to` | Date (`2026-10-01`), inclusive |
| `to` | Today | Date, inclusive; at most 366 days after `from` |
| `channel` | All channels | Sales endpoints only; one of the four channels |

Dates and day boundaries use Toronto time (`America/Toronto`).

### `GET /api/analytics/sales-over-time?from&to&channel&interval`

`interval`: `day` (default), `week` or `month`. Every period in the range is returned, with zeros for periods without sales.

```json
{
  "from": "2026-10-01", "to": "2026-10-07", "interval": "day",
  "points": [
    { "periodStart": "2026-10-01", "salesCount": 3, "unitsSold": 5, "revenueCents": 6100 },
    { "periodStart": "2026-10-02", "salesCount": 0, "unitsSold": 0, "revenueCents": 0 }
  ]
}
```

### `GET /api/analytics/sales-by-item?from&to&channel&limit`

`limit`: default 10, max 100. Sorted by `unitsSold`, highest first. Sales of deleted items are grouped by name with `itemId: null`.

```json
{
  "from": "2026-10-01", "to": "2026-10-31",
  "data": [
    { "itemId": 7, "itemName": "Flower Print", "unitsSold": 14, "salesCount": 9, "revenueCents": 16800 }
  ]
}
```

### `GET /api/analytics/summary?from&to`

```json
{
  "from": "2026-10-01", "to": "2026-10-31",
  "revenueCents": 95000, "expensesCents": 12500, "profitCents": 82500, "salesCount": 41
}
```

### Definitions

| Field | Meaning |
|---|---|
| `salesCount` | Number of sales (checkouts) |
| `unitsSold` | Total quantity across sale lines |
| `revenueCents` | Sum of sale line totals |
| `expensesCents` | Sum of expense line totals, restocks included |
| `profitCents` | `revenueCents − expensesCents` |

## 7. Health: `/api/health`

No login required.

- `200 { "status": "ok", "database": "ok" }` when the database responds.
- `503 { "status": "error", "database": "unreachable" }` otherwise.
