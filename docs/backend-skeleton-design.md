# Backend Design: Skeleton, D2 Data Model and API (Spring Boot)

**Owner:** Jinuo Tao  
**Status:** Draft for team review  
**Date:** 2026-10-15 (updated 2026-10-19)  
**Branch:** `claude-demo`

## 1. Purpose

We are replacing the Node/Express demo server (`demo/server`) with the Java + Spring Boot backend described in `planning.md`. This document covers the **shared skeleton** (the project, conventions and infrastructure every backend feature is built on), the **D2 data model** (§6) and the **D2 API** (§7). The TypeScript demo on `claude-demo` is the reference design: Java matches it unless this document says otherwise.

The skeleton is done when:

1. The existing React client (`demo/client`) can load the Inventory page against the Java backend with no frontend changes.
2. A teammate can clone the repo, run two commands, and have the backend running locally against Postgres.
3. The app runs on Render, connected to the hosted Neon database.

## 2. Scope

**In scope**

- Spring Boot project in `backend/`, built with the Maven wrapper
- Postgres connection, local (Docker) and hosted (Neon)
- Flyway migrations, starting with the `items` table
- Shared response formats: errors and paginated lists
- Global error handler
- `GET /api/health`
- A minimal example module (`items`) that shows the pattern for other modules
- Test setup with Testcontainers, plus one test
- Dockerfile and Render config
- `backend/README.md` with run instructions

**Out of scope** (later, in each owner's own module)

- Full Items CRUD (Diana, §7.1)
- Sales (Jinuo, §7.2; next step after the skeleton)
- Expenses (owner to be decided, §7.3)
- Analytics endpoints (Aidan, §7.4)
- Sign-up and login (Hans; see Q4)
- Demo data seeder (Q20)
- Deleting `demo/server` (done once the Java backend replaces every route)

## 3. Technology decisions

| Area | Choice | Reason |
|---|---|---|
| Language | **Java 25** (current LTS) | Long-term support. Java 26 and 27 are non-LTS and stop getting fixes after about 6 months. |
| Framework | **Spring Boot 4.x** (latest stable from start.spring.io) | Matches `planning.md`. |
| Build | **Maven** + wrapper (`mvnw`, `mvnw.cmd`) | Nobody needs to install Maven, and everyone builds with the same version. |
| Database | **PostgreSQL 17** | Matches `planning.md`. |
| Data access | **Spring Data JPA** for CRUD; native SQL queries for analytics | JPA removes boilerplate. Analytics needs `GROUP BY`, which is clearer in SQL. |
| Schema changes | **Flyway** | Versioned SQL files that run in order, once, on startup. Safe with several people changing the schema. |
| Validation | **Jakarta Bean Validation** (`@NotBlank`, `@Min`, …) | Built into Spring and maps cleanly onto our error format. |
| Tests | **JUnit 5 + Spring Boot Test + Testcontainers** | Tests run against a real, throwaway Postgres in Docker, including our migrations. |
| Local DB | **Docker Compose** | Same Postgres version for everyone; no shared database to wipe by accident. |
| Hosted DB | **Neon** (free tier) | Free, doesn't expire, standard Postgres. |
| Hosting | **Render**, one Docker web service | One URL serves both the React app and `/api`. |

**Dependencies (start.spring.io):** Spring Web, Spring Data JPA, Validation, PostgreSQL Driver, Flyway Migration, Spring Security, Spring Session JDBC, Testcontainers.

## 4. Repository layout

```
18-Jack-Of-All-Trades/
  demo/client/                 # React app (unchanged)
  demo/server/                 # Node server (kept until fully replaced)
  backend/
    pom.xml
    mvnw, mvnw.cmd, .mvn/
    compose.yaml               # local Postgres
    Dockerfile                 # builds client + backend for Render
    README.md
    src/main/java/ca/jackofalltrades/
      JackOfAllTradesApplication.java
      common/                  # shared by every module
        api/ApiError.java
        api/FieldError.java
        api/GlobalExceptionHandler.java
        api/NotFoundException.java
        api/Paginated.java
        api/PageQuery.java
        health/HealthController.java
        web/SpaForwardingController.java
      items/                   # example module; Diana extends it
        Item.java              # JPA entity
        ItemRepository.java
        ItemService.java
        ItemController.java
        ItemResponse.java      # what the API returns
    src/main/resources/
      application.yml
      db/migration/
        V20261015_1__create_items.sql
    src/test/java/ca/jackofalltrades/
      PostgresTestBase.java    # starts a Testcontainers Postgres
      items/ItemControllerTest.java
```

### Package name

`ca.jackofalltrades`. Java packages are namespaces that mirror the folder structure; the convention is a reversed domain. It only needs to be unique to our project.

### Package by feature

Each feature gets one package containing its own controller, service, repository and entity. Shared code lives only in `common/`. Teammates working on different features therefore edit different folders, which keeps merge conflicts rare.

Layers within a module (same idea as the Node demo):

```
Controller  -> HTTP only: read the request, validate, call the service, return a response
Service     -> business rules and transactions (@Transactional)
Repository  -> database access (Spring Data JPA interface)
Entity      -> maps to a table; never returned from a controller directly
Response    -> record that defines the JSON shape sent to the client
```

Controllers return `*Response` records rather than entities, so changing a table doesn't silently change the API.

## 5. API conventions

These match what the React client already expects (`demo/client/src/api/http.ts`, `demo/client/src/types.ts`). **Every module must follow them.**

### Routes

- All endpoints live under `/api`, e.g. `/api/items`, `/api/sales`, `/api/analytics/...`
- Plural nouns. IDs in the path: `/api/items/{id}`
- `GET` lists and reads, `POST` creates (returns `201`), `PATCH` updates, `DELETE` deletes (returns `204`, empty body)

### JSON

- Field names in **camelCase** (`unitPriceCents`, `soldAt`, `createdAt`)
- Money is always an **integer number of cents**, with field names ending in `Cents`. Never floats.
- Timestamps are ISO-8601 strings in UTC, e.g. `"2026-10-15T18:30:00Z"`
- IDs are numbers

### Paginated lists

Request: `GET /api/items?page=1&pageSize=10&search=soap`

| Param | Default | Rules |
|---|---|---|
| `page` | 1 | 1-based, ≥ 1 |
| `pageSize` | 10 | 1–100 |
| `search` | none | optional, trimmed, ≤ 100 chars |

Response:

```json
{
  "data": [ ... ],
  "page": 1,
  "pageSize": 10,
  "total": 42,
  "totalPages": 5
}
```

`totalPages` is at least 1, even when `total` is 0. Spring Data pages are 0-based internally, so `Paginated.from(page)` converts them; modules never build this object by hand.

### Errors

Every error response has this shape:

```json
{
  "error": {
    "message": "Validation failed",
    "details": [
      { "field": "quantity", "message": "Quantity cannot be negative" }
    ]
  }
}
```

`details` is only present for validation errors. The frontend shows each `field` message next to the matching form input, so `field` must be the JSON field name (e.g. `items[0].quantity`).

`GlobalExceptionHandler` maps exceptions to statuses:

| Cause | Status | Message |
|---|---|---|
| Bean Validation failure on a request body or query | 400 | `Validation failed` + `details` |
| Malformed JSON body | 400 | `Request body is not valid JSON` |
| Wrong type in path or query (e.g. `/api/items/abc`) | 400 | `Invalid value for '<param>'` |
| Not logged in | 401 | `Login required` |
| Missing or invalid CSRF token | 403 | `Invalid or missing CSRF token` |
| Email already registered (sign-up) | 409 | `An account with that email already exists` |
| `NotFoundException` thrown by a service (including another account's id) | 404 | e.g. `Item 7 not found` |
| Unknown `/api/...` route | 404 | `Route GET /api/xyz not found` |
| Stock would go below 0 (`items_quantity_check` violation; Q19) | 400 | `Not enough stock` |
| Other database constraint violation (foreign key, unique, check) | 400 | short generic message, e.g. `Value is not allowed` |
| Database unreachable | 503 | `Database is unavailable, try again shortly` |
| Anything else | 500 | `Internal server error` (details are logged, never sent) |

Modules signal errors by **throwing** (`throw new NotFoundException("Item", id)`), never by building error responses themselves.

## 6. Database

### Migrations (Flyway)

- Files live in `backend/src/main/resources/db/migration/`
- They run automatically on startup, in version order, exactly once per database
- **Never edit a migration after it has been merged.** To change the schema, add a new one.
- **Naming:** `V<yyyymmdd>_<n>__<description>.sql`, e.g. `V20261016_1__create_sales.sql`. Dates rather than 1, 2, 3 stop two people from both creating `V2` on separate branches. If a file for that date already exists, use the next `<n>`.
- `spring.flyway.out-of-order: true` is enabled. A branch merged late can carry an older date than a migration already applied to Neon; without this setting Flyway would refuse to start.
- Hibernate is set to `ddl-auto: validate`. It checks that entities match the tables but never changes them; only Flyway changes the schema.

### Reference implementation

The TypeScript backend on `claude-demo` (`demo/server/src`) is the **reference design**. The Java backend reproduces its tables, endpoints, JSON, validation limits and business rules, so the existing React client works unchanged. This document only spells out the **differences** and the parts the demo doesn't have (accounts, sales channel, analytics). When this document is silent, do what the demo does.

| Area | Java backend | Same as demo? |
|---|---|---|
| Tables, columns, constraints | Same (via Flyway instead of `schema.ts`) | ✅, plus `sales.channel` |
| Items, Sales, Expenses endpoints and JSON | Same | ✅, plus `channel` on sales |
| Validation limits | Same (`*.schema.ts` → Bean Validation) | ✅ |
| Stock rules for sales and expenses | Same | ✅, plus a readable oversell error |
| Error format, paging format | Same (`errorHandler.ts`, `pagination.ts`) | ✅ |
| Per-account data (`users`, `user_id` on every table) | New (§6 *Accounts and data ownership*, Q4) | ➕ |
| Analytics endpoints | New (§7.4) | ➕ |
| Schema setup | Flyway migrations; the demo's `DROP_LEGACY_SALES_TABLE` step is not carried over | Changed |

### Migration files

One file per table group, owned by the module's owner:

| File | Tables | Owner |
|---|---|---|
| `V20261015_1__create_users_and_items.sql` | `users`, `items` | Jinuo (skeleton); `users` details with Hans, `items` with Diana |
| `V20261020_1__create_sales.sql` | `sales`, `sale_items` | Jinuo |
| `V20261015_2__create_spring_session.sql` | `spring_session`, `spring_session_attributes` (copied from Spring Session's PostgreSQL schema) | Jinuo (skeleton) |
| `V20261020_2__create_expenses.sql` | `expenses`, `expense_items` | Expenses owner (Q16) |

### Tables

Copied from `demo/server/src/db/schema.ts`. Additions: the `users` table, `user_id` on `items`, `sales` and `expenses` (Q4), and `sales.channel`. Line tables (`sale_items`, `expense_items`) get their owner through their parent.

```sql
-- NEW (Q4). One account = one business.
CREATE TABLE users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,  -- BCrypt via Spring Security; never the raw password
  display_name  TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_email ON users (lower(email));  -- case-insensitive uniqueness

CREATE TABLE items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- NEW (Q4)
  name             TEXT        NOT NULL,
  quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  note             TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_user_name ON items (user_id, name);

-- One sale = one transaction (checkout); its lines are in sale_items.
CREATE TABLE sales (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- NEW (Q4)
  sold_at    TIMESTAMPTZ NOT NULL,
  channel    TEXT        NOT NULL
             CHECK (channel IN ('IN_PERSON', 'ONLINE', 'COMMISSION', 'MISC')),  -- NEW (US1, Q2)
  tags       TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_user_sold_at ON sales (user_id, sold_at);

CREATE TABLE sale_items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id          INTEGER NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  -- Nullable + name snapshot: past sales keep their history if the item is renamed or deleted.
  item_id          INTEGER REFERENCES items (id) ON DELETE SET NULL,
  item_name        TEXT    NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_cents      INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
);
CREATE INDEX idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX idx_sale_items_item_id ON sale_items (item_id);

-- One expense = one transaction (a supplier order or a bill). A line either restocks
-- an item (item_id set) or is a free-text cost like "Rent" (item_id NULL, item_name = description).
CREATE TABLE expenses (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- NEW (Q4)
  incurred_at TIMESTAMPTZ NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_user_incurred_at ON expenses (user_id, incurred_at);

CREATE TABLE expense_items (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_id      INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  item_id         INTEGER REFERENCES items (id) ON DELETE SET NULL,
  item_name       TEXT    NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  total_cents     INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
);
CREATE INDEX idx_expense_items_expense_id ON expense_items (expense_id);
CREATE INDEX idx_expense_items_item_id ON expense_items (item_id);
```

- A sale's or expense's `totalCents` isn't stored; it's the sum of its lines' `total_cents`, as in the demo.
- `updated_at` is set by Hibernate (`@UpdateTimestamp`) on every update.
- In Java, `TEXT[]` maps to `List<String>` with `@JdbcTypeCode(SqlTypes.ARRAY)`.

### Accounts and data ownership (Q4)

Every account sees and changes **only its own** items, sales, expenses and analytics.

- **Who is asking:** a `CurrentUser` component returns the logged-in user's id from the security context. Services take the user id from it, never from the request body or query string.
- **Every query filters by owner:** repositories only offer methods that take a `userId` (e.g. `findByIdAndUserId`, `findPageByUserId`). There is no unscoped `findById` for owned tables, so forgetting the filter doesn't compile.
- **Someone else's id → 404,** not 403: `GET /api/sales/42` for another account's sale returns `Sale 42 not found`, so ids don't reveal other accounts' data.
- **Line references are checked too:** a sale or expense line whose `itemId` belongs to another account fails exactly like a nonexistent item (`Item 7 does not exist`).
- **Stock updates include the owner:** `UPDATE items SET quantity = quantity + :delta WHERE id = :id AND user_id = :userId`.
- **Analytics** queries filter by `user_id` on `sales` / `expenses`.
- **New accounts start empty.** The demo seeder (Q20) creates one demo account with sample data.
- Login uses a server-side session cookie (Q21, §7.0).

### Stock rules (same as the demo)

Every write runs in one `@Transactional` service method, so stock and the sale or expense rows change together or not at all.

| Action | Stock effect | Rejected when |
|---|---|---|
| Record sale | Each line: `quantity − line.quantity`; snapshot the item's current name and price | Item doesn't exist; not enough stock |
| Edit sale | Restore the old lines, then apply the new ones (the whole line list is replaced) | Same as record |
| Delete / bulk-delete sale | Restore each line (lines whose item was deleted are skipped) | — |
| Record expense | Restock lines: `quantity + line.quantity`; free-text lines don't touch stock | Restocked item doesn't exist |
| Edit expense | Undo the old restocks, then apply the new lines | Undoing would take stock below 0 ("some may have already been sold") |
| Delete / bulk-delete expense | Undo each restock | Same as edit |
| Delete item | Hard delete; lines keep `item_name` and get `item_id = NULL` | — |

- **Prices:** a sale line always uses the item's **current** price; there is no per-line override (Q11).
- **First error wins:** like the demo, the first failing line stops the request with a 400 whose message names the item, e.g. `Not enough stock for "Flower Print" (have 1, need 2)`.
- **Concurrency (Q19):** the service checks stock, then runs `UPDATE items SET quantity = quantity + :delta`. If two requests race, `CHECK (quantity >= 0)` makes Postgres reject the one that would oversell. The Java error handler maps that specific violation (`items_quantity_check`) to `400 Not enough stock`, instead of the demo's generic "Value is not allowed".

### Not in D2 (from the Lucidchart)

| Feature | Note |
|---|---|
| Item types, sizes, currency | Lucidchart item fields |
| Events (markets, conventions) | Table fee, status, days; in-person sales link to one |
| Discounts, charges, tips | Discount rules (buy 2 get 1, tiered, %) are their own project |
| Expense category / manufacturer | Lucidchart expense fields |
| Commissions, to-do list, services | |
| Item deactivation | Lucidchart grays out old items; the demo hard-deletes (Q7) |

## 7. D2 API

Same endpoints and JSON as the demo (see `*.routes.ts` and `demo/client/src/types.ts`), plus `channel` on sales and the new analytics endpoints. Every `/api` endpoint except `/api/health` and the auth endpoints (Q21) requires login and returns `401` without it; all data is scoped to the logged-in account (§6).

### 7.0 Accounts: `/api/auth` (Hans)

Login uses a **session cookie** (Q21). After sign-up or login, the browser sends the session cookie automatically with every request; `http.ts` needs no token handling.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ "email", "password", "displayName" }` | `201` `User`, and logged in | `400` validation; `409` email already registered |
| POST | `/api/auth/login` | `{ "email", "password" }` | `200` `User` | `401` `Invalid email or password` |
| POST | `/api/auth/logout` | — | `204` | — |
| GET | `/api/auth/me` | — | `200` `User` | `401` not logged in |

```json
{ "id": 3, "email": "allie@example.com", "displayName": "Allie" }
```

- **Validation:** `email` is a valid address, ≤ 254 chars, stored as typed but matched case-insensitively. `password` is 8–72 characters (BCrypt ignores anything past 72 bytes). `displayName` ≤ 60 chars, optional.
- **Login errors don't say which part was wrong** ("Invalid email or password"), so the form can't be used to discover registered emails.
- **Sessions** are stored in Postgres with Spring Session JDBC, so a Render redeploy or a free-tier sleep doesn't log anyone out. A session expires after **7 days** without activity. Spring Security issues a new session id on login (protection against session fixation).
- **Cookie:** `HttpOnly` (JavaScript can't read it), `SameSite=Lax`, and `Secure` on Render (HTTPS only).
- **CSRF protection:** because the browser sends the cookie automatically, other websites could otherwise make requests as the user. Spring Security's `CookieCsrfTokenRepository` sets a readable `XSRF-TOKEN` cookie; `http.ts` copies its value into an `X-XSRF-TOKEN` header on every `POST`, `PATCH` and `DELETE`. The React app calls `GET /api/auth/me` on startup, which also sets the cookie. A missing or wrong token returns `403`.
- **On app start**, the client calls `GET /api/auth/me`: `200` shows the app, `401` shows the login page.

### 7.1 Items: `/api/items` (US2, Diana)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/items?page&pageSize&search` | — | `200` `Paginated<Item>`, ordered by `id` ascending |
| GET | `/api/items/{id}` | — | `200` `Item` |
| POST | `/api/items` | `ItemInput` | `201` `Item` |
| PATCH | `/api/items/{id}` | any subset of `ItemInput`, at least one field | `200` `Item` |
| DELETE | `/api/items/{id}` | — | `204` |
| POST | `/api/items/bulk-delete` | `{ "ids": [1, 2] }` (1–100 ids) | `200` `{ "deleted": 2 }` |

`search` matches name or tags, case-insensitive.

```json
{
  "id": 7, "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200,
  "tags": ["print"], "note": "",
  "createdAt": "2026-10-19T20:00:00Z", "updatedAt": "2026-10-19T20:00:00Z"
}
```

`ItemInput`: `name` (1–120 chars, trimmed), `quantity` and `unitPriceCents` (whole numbers ≥ 0), `tags` (≤ 10, each 1–30 chars, duplicates removed, default `[]`), `note` (≤ 1000 chars, default `""`).

### 7.2 Sales: `/api/sales` (US1, Jinuo)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/sales?page&pageSize&search&channel` | — | `200` `Paginated<Sale>`, newest `soldAt` first |
| GET | `/api/sales/{id}` | — | `200` `Sale` |
| POST | `/api/sales` | `SaleInput` | `201` `Sale` |
| PATCH | `/api/sales/{id}` | `SaleInput` (replaces the whole sale and its lines) | `200` `Sale` |
| DELETE | `/api/sales/{id}` | — | `204` |
| POST | `/api/sales/bulk-delete` | `{ "ids": [1, 2] }` | `200` `{ "deleted": 2 }` |

`search` matches tags or item names on the lines. `channel` (new) filters to one channel.

```json
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
```

`SaleInput`:

```json
{ "soldAt": "2026-10-18T15:30:00-04:00", "channel": "IN_PERSON", "tags": [], "items": [ { "itemId": 7, "quantity": 2 } ] }
```

`soldAt`: ISO-8601 with an offset. `channel`: required, one of `IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC`. `items`: 1–50 lines, each `itemId` and `quantity` ≥ 1. `tags`: as for items.

### 7.3 Expenses: `/api/expenses` (Q16)

Same endpoint set as Sales (`GET` list with `search`, `GET` one, `POST`, `PATCH` replace, `DELETE`, `POST bulk-delete`), ordered by newest `incurredAt`.

```json
{
  "id": 5, "incurredAt": "2026-10-10T12:00:00Z", "tags": ["supplies"], "totalCents": 17500,
  "items": [
    { "id": 11, "itemId": 7, "itemName": "Flower Print", "quantity": 200, "unitCostCents": 75, "totalCents": 15000 },
    { "id": 12, "itemId": null, "itemName": "Shipping", "quantity": 1, "unitCostCents": 2500, "totalCents": 2500 }
  ],
  "createdAt": "2026-10-10T12:01:00Z", "updatedAt": "2026-10-10T12:01:00Z"
}
```

`ExpenseInput`: `incurredAt`, `tags`, and 1–50 lines of `{ itemId: number | null, description, quantity ≥ 1, unitCostCents ≥ 0 }`. Each line needs an `itemId` (restock) **or** a non-empty `description` (free-text cost, ≤ 120 chars).

### 7.4 Analytics: `/api/analytics` (US3, Aidan), new

Read-only. Revenue comes from `sale_items.total_cents`; expenses from `expense_items.total_cents`.

| Param | Default | Rules |
|---|---|---|
| `from` | 30 days before `to` | date, inclusive |
| `to` | today | date, inclusive; range ≤ 366 days |
| `channel` | all | sales endpoints only |

**Sales over time:** `GET /api/analytics/sales-over-time?from&to&channel&interval`, with `interval` = `day` (default), `week` or `month`. Every period in the range is returned, with zeros for empty periods, so charts have no gaps.

```json
{ "from": "2026-10-01", "to": "2026-10-07", "interval": "day",
  "points": [ { "periodStart": "2026-10-01", "salesCount": 3, "unitsSold": 5, "revenueCents": 6100 } ] }
```

**Sales per item:** `GET /api/analytics/sales-by-item?from&to&channel&limit` (`limit` default 10, max 100), sorted by `unitsSold` descending. Lines whose item was deleted are grouped by `itemName` with `itemId: null`.

```json
{ "from": "2026-10-01", "to": "2026-10-31",
  "data": [ { "itemId": 7, "itemName": "Flower Print", "unitsSold": 14, "salesCount": 9, "revenueCents": 16800 } ] }
```

**Summary (for the dashboard tiles):** `GET /api/analytics/summary?from&to`

```json
{ "from": "2026-10-01", "to": "2026-10-31", "revenueCents": 95000, "expensesCents": 12500, "profitCents": 82500, "salesCount": 41 }
```

Definitions: `salesCount` = number of sales; `unitsSold` = sum of line quantities; `revenueCents` = sum of sale line totals; `expensesCents` = sum of expense line totals (restocks included); `profitCents` = revenue − expenses. Dates are interpreted in `America/Toronto` (Q17). Sums use `BIGINT`.

### 7.5 Frontend changes needed

| Page | Change | Owner |
|---|---|---|
| Sale form, `types.ts` | Required channel dropdown; add `channel` to `Sale` and `SaleInput` | Minh |
| Sales list | Show the channel; optional channel filter | Minh |
| Analytics | Replace the mock data with §7.4 | Kimberly |
| Sign-up, login, logout | New pages using §7.0; check `GET /api/auth/me` on startup; on any `401`, go to the login page | Hans |
| `http.ts` | Send the `X-XSRF-TOKEN` header (value of the `XSRF-TOKEN` cookie) on `POST`, `PATCH`, `DELETE` | Hans |

Items and Expenses pages need no changes beyond the shared `401` handling.

## 8. Configuration

`application.yml` reads everything environment-specific from environment variables, with defaults that work for local development:

| Variable | Local default | On Render |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/jack` | Neon JDBC URL, ending in `?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` | `jack` | Neon user |
| `SPRING_DATASOURCE_PASSWORD` | `jack` | Neon password (Render secret) |
| `PORT` | `4000` | set by Render |

- **No secrets are committed.** The local defaults only work against the Docker database.
- Port `4000` matches the Vite proxy in `demo/client/vite.config.ts`, so the client works unchanged.
- Docker Postgres is mapped to host port **5433**, so it doesn't clash with any Postgres already installed on 5432.
- These are Spring's standard variable names, so no custom parsing code is needed. The Node server's single `DATABASE_URL` is not reused, because JDBC needs a different URL format.

## 9. Health check

`GET /api/health` runs `SELECT 1` against the database:

- `200 {"status":"ok","database":"ok"}` when the database responds
- `503 {"status":"error","database":"unreachable"}` otherwise

Render uses this path as its health check.

## 10. Example module: `items` (skeleton version)

Only enough to prove the pattern and let the Inventory page load:

- `GET /api/items?page&pageSize&search`: paginated, case-insensitive name search, newest first
- `GET /api/items/{id}`: one item, or 404

Create, update, delete and bulk delete belong to Diana's Inventory work and are built on this structure.

## 11. Local development

Prerequisites: JDK 25, Docker Desktop, and Node 22+ (for the client).

```bash
cd backend
docker compose up -d          # start Postgres on localhost:5433
./mvnw spring-boot:run        # Windows: mvnw.cmd spring-boot:run   -> http://localhost:4000

# in another terminal
cd demo/client
npm install
npm run dev                   # http://localhost:5173, /api proxied to :4000
```

Tests: `./mvnw test` (Docker must be running).

## 12. Testing

- `PostgresTestBase` starts one Postgres container per test run using Spring Boot's `@ServiceConnection`, so tests never touch your local or hosted database.
- Flyway runs against that container, which means every test run also checks that the migrations apply cleanly.
- The skeleton ships with `ItemControllerTest`, which covers:
  - list returns the paginated shape
  - unknown id returns 404 in the error format
  - `pageSize=500` returns 400 with `details`
- Each module owner adds tests for their own endpoints, following the same pattern.

## 13. Deployment (Render)

One Docker web service, built from a multi-stage `backend/Dockerfile`:

1. **Node stage:** `npm ci && npm run build` in `demo/client`, which produces `dist/`
2. **Maven stage:** copies `dist/` into `src/main/resources/static/`, then runs `./mvnw package -DskipTests`
3. **Runtime stage:** `eclipse-temurin:25-jre`, running the jar

Spring serves the React files. `SpaForwardingController` forwards any non-`/api` path without a file extension (e.g. `/inventory`) to `index.html`, so React Router handles it. Unknown `/api/...` paths still return the JSON 404.

Render settings: Docker runtime, health check path `/api/health`, the three `SPRING_DATASOURCE_*` variables set as secrets. `demo/render.yaml` is updated (or a new root `render.yaml` added) to point at `backend/Dockerfile`.

## 14. Decisions

Guiding rule (decided 2026-10-19): **match the `claude-demo` TypeScript design unless it is clearly harmful.** Most questions below are therefore settled by "do what the demo does". Reply in Discord with the question ID (e.g. "Q4: agree" or "Q4: prefer B") for anything still open.

### Open

**Q17. Time zone for dates.** "Sales on Oct 18" and daily analytics buckets depend on a time zone: a sale at 9 PM Toronto time is already Oct 19 in UTC.

- Recommendation: store timestamps in UTC (`TIMESTAMPTZ`, as the demo does); interpret analytics date ranges and group by day in `America/Toronto`.
- Confirm: Aidan, Kimberly

**Q12. Branching.** Will `claude-demo` be merged into `main`? This design and the Java backend are on `claude-demo` because the React client lives there.

- Confirm: Hans

**Q13. Neon and Render ownership.** Who creates the Neon project and the Render service, and who gets dashboard access?

- Recommendation: Jinuo creates both and invites the team.
- Confirm: team

**Q14. Lucidchart in the repo.** Export the Lucidchart to `docs/data-model.pdf` so the design, and anyone prompting Claude with it, can reference it.

- Confirm: Diana

### Decided

| # | Question | Decision |
|---|---|---|
| Q1 | US2 goal text in the D2 split duplicates US1 | Use the `planning.md` version (add and update products). Fix the split doc. |
| Q2 | What a sales channel is | New `channel` column: `IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC` (the Lucidchart's four sale types). No storefront name for D2. |
| Q3 | Selling more than is in stock | Rejected with a 400 (as the demo). |
| Q4 | Separate data per account | **Private per account.** `users` table; `user_id` on `items`, `sales`, `expenses`; every query scoped to the logged-in user; other accounts' ids return 404. One account = one business (no staff accounts). |
| Q21 | How login works | **Session cookie** via Spring Security, sessions stored in Postgres (Spring Session JDBC), CSRF token in a cookie + header. Details in §7.0. Owner: Hans. |
| Q5 | How stock is tracked | A `quantity` column changed by sales and expenses (as the demo). A stock-movements ledger may come later. |
| Q6 | Money | Integer cents everywhere (as the demo). One currency; per-item currency is not in D2. |
| Q7 | Deleting items | Hard delete; past lines keep the item name (as the demo). Lucidchart-style deactivation comes later. |
| Q8 | Item types, sizes, currency | After D2. |
| Q9 | `tags` and `note` on items | Keep them (as the demo). |
| Q10 | Sale total | Not stored; the sum of line totals (as the demo). |
| Q11 | Per-line price override, free, trade | Not in D2: lines use the item's current price (as the demo). |
| Q15 | Tags on sales | Keep (as the demo; frontend confirmed). |
| Q16 | Expenses in D2 | Full Expenses, including restocking (as the demo). Analytics uses it for expenses and profit. Needs an owner. |
| Q18 | Backend for the D2 demo | Java. `demo/server` stops being deployed once Java reaches parity. |
| Q19 | Stock concurrency | Demo approach (check, then `quantity + delta`) with `CHECK (quantity >= 0)` as the guarantee; that constraint violation is mapped to a readable "Not enough stock" error. |
| Q20 | Demo data | A Java seeder enabled by the `demo` Spring profile: when the database is empty it creates ~20 items, ~6 weeks of sales across all four channels, and a few expenses, with dates relative to today. Writes go through the services, so stock rules apply. Never runs in tests. |

## 15. Build order

1. Generate the project (start.spring.io), add the wrapper, `compose.yaml` and `application.yml`. The app starts and connects.
2. Flyway + `V20261015_1__create_items.sql`.
3. `common/`: `ApiError`, `GlobalExceptionHandler`, `NotFoundException`, `Paginated`, `PageQuery`.
4. `HealthController`.
5. `items` example module.
6. Testcontainers base class + `ItemControllerTest`.
7. Run `demo/client` against it and confirm the Inventory page loads.
8. Dockerfile + SPA forwarding; deploy to Render with Neon.
9. `backend/README.md`; open a PR for review.
