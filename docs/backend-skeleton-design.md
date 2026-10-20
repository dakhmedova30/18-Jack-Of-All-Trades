# Backend Design: Skeleton + D2 Data Model (Spring Boot)

**Owner:** Jinuo Tao  
**Status:** Draft for team review  
**Date:** 2026-10-15 (updated 2026-10-19)  
**Branch:** `claude-demo`

## 1. Purpose

We are replacing the Node/Express demo server (`demo/server`) with the Java + Spring Boot backend described in `planning.md`. This document covers only the **shared skeleton**: the project, conventions and infrastructure that every backend feature (Sales, Inventory, Analytics, Sign-up) is built on.

The skeleton is done when:

1. The existing React client (`demo/client`) can load the Inventory page against the Java backend with no frontend changes.
2. A teammate can clone the repo, run two commands, and have the backend running locally against Postgres.
3. The app runs on Render, connected to the hosted Neon database.

## 2. Scope

**In scope**

- Spring Boot project in `backend/`, built with the Maven wrapper
- Postgres connection, local (Docker) and hosted (Neon)
- Flyway migrations, with a minimal `items` table
- Shared response formats: errors and paginated lists
- Global error handler
- `GET /api/health`
- A minimal example module (`items`) that shows the pattern for other modules
- Test setup with Testcontainers, plus one test
- Dockerfile and Render config
- `backend/README.md` with run instructions

**Out of scope** (later, in each owner's own module)

- Full Inventory CRUD (Diana): create, update, delete, search, tags, image, public visibility
- Sales (Jinuo, next step after the skeleton)
- Analytics endpoints (Aidan)
- Sign-up and login (Hans)
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

**Dependencies (start.spring.io):** Spring Web, Spring Data JPA, Validation, PostgreSQL Driver, Flyway Migration, Spring Boot Actuator (optional), Testcontainers.

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
        V20261015_1__create_businesses_and_items.sql
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
| `NotFoundException` thrown by a service | 404 | e.g. `Item 7 not found` |
| Unknown `/api/...` route | 404 | `Route GET /api/xyz not found` |
| Database constraint violation (foreign key, unique, check) | 400 | short generic message, e.g. `Value is not allowed` |
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

### First migration: `businesses` + `items` (minimal)

The skeleton creates only the columns every version of Inventory and Sales needs. Diana adds the rest in her own migration (see §14, decisions Q7–Q9).

```sql
-- Whose data a row belongs to. One seeded row until login exists (decision Q4).
CREATE TABLE businesses (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO businesses (name) VALUES ('Demo Business');

CREATE TABLE items (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_id      BIGINT      NOT NULL REFERENCES businesses (id),
    name             TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    active           BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_business_name ON items (business_id, name);
```

**Known gap:** the current React `Item` type also has `tags` and `note`. Until decision Q9 is made, `ItemResponse` returns `tags: []` and `note: ""` so the Inventory page still renders.

### D2 data model (draft)

Derived from the D2 user stories and the team's Lucidchart (`CSC301 Database Design`). The Lucidchart describes **screens**; this translates them into tables. Values marked `*` in the Lucidchart (auto-calculated) are computed by the backend, not stored or typed in, except where noted.

**In D2:** `businesses`, `items`, `sales`, `sale_items`.

```sql
sales        id, business_id → businesses
             channel     TEXT        NOT NULL   -- IN_PERSON | ONLINE | COMMISSION | MISC   (Q2)
             storefront  TEXT        NULL       -- optional: "Etsy", "Comic Con 2026"         (Q2)
             sold_at     TIMESTAMPTZ NOT NULL
             note        TEXT        NOT NULL DEFAULT ''
             tags        TEXT[]      NOT NULL DEFAULT '{}'  -- the React client already uses these (Q15)
             total_cents INTEGER     NOT NULL   -- sum of line totals, written with the lines (Q10)
             created_at, updated_at

sale_items   id, sale_id → sales (ON DELETE CASCADE)
             item_id          → items, NULL allowed (ON DELETE SET NULL)
             item_name        TEXT    NOT NULL  -- copied from the item at sale time
             quantity         INTEGER NOT NULL CHECK (quantity > 0)
             unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)  -- defaults to item price (Q11)
             line_total_cents INTEGER NOT NULL  -- quantity × unit_price_cents
```

`sales` is owned by Jinuo (US1) and created in his own migration; `items` changes belong to Diana (US2).

**Sales service rules** (enforced in code, inside one transaction per request):

| Action | Stock effect |
|---|---|
| Create sale | Subtract each line's quantity from its item. Rejected if any item would go below zero (Q3). |
| Edit sale | Restore the old lines' quantities, then subtract the new lines' quantities. |
| Delete sale | Restore each line's quantity. |

- Inactive items can't be added to new sales. Existing sales that include them still display normally.
- `item_name` and `unit_price_cents` are copied into each line, so renaming or repricing an item never changes past sales or analytics.

**US1 mapping:** amount = `total_cents`, date = `sold_at`, product = the lines, sales channel = `channel` (+ optional `storefront`).

**Later (in the Lucidchart, not in D2):**

| Table | Purpose | Note |
|---|---|---|
| `item_types` | User-defined categories (Print, Sticker, Charm…) | Items sorted by type |
| item size / currency | Size `W × H` + unit; currency | See Q6 for currency |
| `events` | Markets and conventions: days, location, table fee, extra expenses, status, going | In-person sales link to one |
| `sale_adjustments` | Discounts, charges, tips | Discount *rules* (buy 2 get 1, tiered, %) are a separate project |
| `expenses` + `expense_items` | Supply purchases by category / manufacturer | Buying items adds stock (Q5). Already built in the Node demo (Q16). |
| `commissions` | Per-customer requests with deadline, expenses, revenue | |
| `tasks` | To-do list with category and deadline | |
| services | Not yet defined in the Lucidchart | |

Revenue, expenses, profit, "amount sold", and the monthly and yearly views are **queries** (Analytics), not tables.

## 7. D2 API

Every endpoint follows the conventions in §5 (routes, camelCase JSON, cents, pagination, error format). JSON names match `demo/client/src/types.ts` wherever the client already has the field, so existing pages keep working. New fields the frontend must add are listed in §7.4.

All requests are scoped to business `1` until login exists (Q4).

### 7.1 Inventory: `/api/items` (US2, Diana)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/items?page&pageSize&search&includeInactive` | — | `200` `Paginated<Item>` |
| GET | `/api/items/{id}` | — | `200` `Item` |
| POST | `/api/items` | `ItemInput` | `201` `Item` |
| PATCH | `/api/items/{id}` | partial `ItemInput` (only the fields that change) | `200` `Item` |
| DELETE | `/api/items/{id}` | — | `204` (deactivates; Q7) |
| POST | `/api/items/bulk-delete` | `{ "ids": [1, 2] }` | `200` `{ "deleted": 2 }` (deactivates) |

- `search`: case-insensitive match on name. `includeInactive` defaults to `false`.
- Results are sorted newest first.

#### Item

```json
{
  "id": 7,
  "name": "Flower Print (8x12)",
  "quantity": 10,
  "unitPriceCents": 1200,
  "active": true,
  "tags": [],
  "note": "",
  "createdAt": "2026-10-19T20:00:00Z",
  "updatedAt": "2026-10-19T20:00:00Z"
}
```

#### ItemInput

POST requires `name`, `quantity` and `unitPriceCents`.

```json
{ "name": "Flower Print (8x12)", "quantity": 10, "unitPriceCents": 1200, "tags": [], "note": "" }
```

**Validation:** name 1–120 chars; quantity and price are whole numbers ≥ 0; PATCH must include at least one field. `tags` / `note` follow Q9.

### 7.2 Sales: `/api/sales` (US1, Jinuo)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/sales?page&pageSize&search&channel&from&to` | — | `200` `Paginated<Sale>` |
| GET | `/api/sales/{id}` | — | `200` `Sale` |
| POST | `/api/sales` | `SaleInput` | `201` `Sale` |
| PATCH | `/api/sales/{id}` | `SaleInput` (**replaces** the whole sale, including all lines) | `200` `Sale` |
| DELETE | `/api/sales/{id}` | — | `204` (restores stock) |
| POST | `/api/sales/bulk-delete` | `{ "ids": [1, 2] }` | `200` `{ "deleted": 2 }` |

- Filters: `search` matches item names on the sale's lines; `channel` is one of the four channel values; `from` / `to` are dates (`2026-10-01`) on `soldAt`, inclusive (see Q17 for time zone).
- Results are sorted by `soldAt`, newest first.
- PATCH replaces the sale rather than merging fields, to match the existing client. Strictly that's `PUT`'s meaning; kept for compatibility.

#### Sale

```json
{
  "id": 42,
  "soldAt": "2026-10-18T15:30:00Z",
  "channel": "IN_PERSON",
  "storefront": "Toronto Comic Con 2026",
  "note": "",
  "tags": [],
  "totalCents": 3500,
  "items": [
    { "id": 101, "itemId": 7, "itemName": "Flower Print (8x12)", "quantity": 2, "unitPriceCents": 1200, "totalCents": 2400 },
    { "id": 102, "itemId": 9, "itemName": "Flower Keychain", "quantity": 1, "unitPriceCents": 1100, "totalCents": 1100 }
  ],
  "createdAt": "2026-10-18T15:31:02Z",
  "updatedAt": "2026-10-18T15:31:02Z"
}
```

A line's `totalCents` is the `line_total_cents` column. `itemId` is `null` if the item was later removed from the database; `itemName` still shows what was sold.

#### SaleInput

```json
{
  "soldAt": "2026-10-18T15:30:00Z",
  "channel": "IN_PERSON",
  "storefront": "Toronto Comic Con 2026",
  "note": "",
  "tags": [],
  "items": [
    { "itemId": 7, "quantity": 2 },
    { "itemId": 9, "quantity": 1, "unitPriceCents": 1100 }
  ]
}
```

- Required: `soldAt`, `channel`, and 1–50 lines.
- Each line: `itemId` must be an active item of this business; `quantity` is a whole number ≥ 1.
- `unitPriceCents` is optional. It defaults to the item's current price; send it to override the price, or `0` for a free item (Q11).
- The same `itemId` may not appear on two lines of one sale.
- `storefront`: optional, ≤ 120 chars. `note`: optional, ≤ 1000 chars.

**Sale-specific errors** (all `400`, in the §5 error format):

| Situation | `details` entry |
|---|---|
| Not enough stock (Q3) | `{ "field": "items[0].quantity", "message": "Only 1 Flower Print (8x12) in stock" }` |
| Item doesn't exist or belongs to another business | `{ "field": "items[1].itemId", "message": "Item 99 not found" }` |
| Item is inactive | `{ "field": "items[1].itemId", "message": "Flower Keychain is inactive" }` |
| Same item on two lines | `{ "field": "items[2].itemId", "message": "Item already on this sale" }` |
| Unknown channel | `{ "field": "channel", "message": "Must be one of IN_PERSON, ONLINE, COMMISSION, MISC" }` |

All lines are checked before anything is written, so the response lists every problem at once and stock is never partly updated.

### 7.3 Analytics: `/api/analytics` (US3, Aidan)

Read-only. Revenue and counts come only from `sales` and `sale_items`.

Common query parameters:

| Param | Default | Rules |
|---|---|---|
| `from` | 30 days before `to` | date, inclusive |
| `to` | today | date, inclusive; range ≤ 366 days |
| `channel` | all channels | one of the four channel values |

**Sales over time**: `GET /api/analytics/sales-over-time?from&to&channel&interval`

`interval` is `day`, `week` or `month` (default `day`). Every period in the range is returned, including periods with no sales (zeros), so the chart has no gaps.

```json
{
  "from": "2026-10-01",
  "to": "2026-10-07",
  "interval": "day",
  "points": [
    { "periodStart": "2026-10-01", "salesCount": 3, "unitsSold": 5, "revenueCents": 6100 },
    { "periodStart": "2026-10-02", "salesCount": 0, "unitsSold": 0, "revenueCents": 0 }
  ]
}
```

**Sales per item**: `GET /api/analytics/sales-by-item?from&to&channel&limit`

`limit` defaults to 10 (max 100). Sorted by `unitsSold`, highest first. Lines whose item was removed are grouped under their `itemName` with `itemId: null`.

```json
{
  "from": "2026-10-01",
  "to": "2026-10-31",
  "data": [
    { "itemId": 7, "itemName": "Flower Print (8x12)", "unitsSold": 14, "salesCount": 9, "revenueCents": 16800 }
  ]
}
```

**Optional, if time allows: sales per channel**: `GET /api/analytics/sales-by-channel?from&to` returns `{ "from", "to", "data": [{ "channel", "salesCount", "revenueCents" }] }`. Not required by US3, but the Lucidchart and the Discord dashboard discussion both group by channel.

**Definitions** (so frontend and backend agree on what the numbers mean):

- `salesCount`: number of sales (transactions)
- `unitsSold`: sum of line quantities
- `revenueCents`: sum of line totals, after any price overrides

### 7.4 Frontend changes needed

| Page | Change | Owner |
|---|---|---|
| Sale form | Add a channel dropdown (required), a storefront text field (optional), and an optional price field per line | Minh |
| Sales list | Show channel and storefront; add channel and date filters | Minh |
| `types.ts` | Add `channel`, `storefront`, `note` to `Sale`; `unitPriceCents?` to `SaleLineItemInput`; `active` to `Item` | Minh, Allie |
| Inventory | Delete becomes "Deactivate"; inactive items grayed out; an option to show inactive items (Q7) | Allie |
| Analytics | Replace the mock data with the two endpoints in §7.3 | Kimberly |

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

## 14. Decisions needed

Each decision lists the options, a recommendation, and who should confirm it. Until confirmed, the draft follows the recommendation. Reply in Discord with the question ID (e.g. "Q3: agree" or "Q3: prefer B").

### Product and scope

**Q1. US2 goal text.** The D2 split's US2 goal ("log individual sales and sales channel…") duplicates US1. `planning.md` defines US2 as *add and update products with name, price and quantity*.

- Recommendation: correct the D2 split doc to match `planning.md`. This design assumes the `planning.md` version.
- Confirm: Diana, Allie

**Q2. What a "sales channel" is.**

- A: four channel types from the Lucidchart (In-Person Market, Online Shop, Commission, Miscellaneous), plus an optional free-text storefront name ("Etsy", "Comic Con 2026")
- B: free-text storefront only (Discord discussion: Etsy, Shopify, store location)
- C: online / in-person only
- Recommendation: **A**. Analytics can group by type, and storefront still captures the Discord idea. When `events` arrive later, in-person sales can link to an event instead of a storefront name.
- Confirm: Minh, Kimberly (charts group by this)

**Q3. Selling more than is in stock.**

- A: reject the sale with a 400 naming the line ("Only 2 Flower Prints in stock")
- B: allow it and let stock go negative; flag it in the UI
- Recommendation: **A** for D2. It's simpler and keeps stock trustworthy. Revisit if market use shows counts are often wrong in practice.
- Confirm: team

### Data

**Q4. Data ownership (`business_id`).** The Lucidchart has no owner on any table, but once sign-up exists each user must only see their own data.

- Recommendation: add `business_id` to every table now, with one seeded business. Queries filter by business `1` until Hans's login supplies the real one. Adding it later means changing every table and query.
- Open sub-question: one user per business, or several users (staff) per business? Affects Hans's `users` table, not D2.
- Confirm: Hans

**Q5. How stock is tracked.**

- A: a `quantity` column, updated whenever a sale or expense changes it
- B: a `stock_movements` ledger (+200 bought, −3 sold), with stock as the sum
- Recommendation: **A** for D2; consider **B** when expenses arrive, because it gives an audit trail of why stock changed.
- Confirm: Diana

**Q6. Money and currency.** The Lucidchart types prices as `Float` and has a currency dropdown per item and per event.

- Recommendation: store money as **integer cents** everywhere (floats accumulate rounding errors; `0.1 + 0.2 ≠ 0.3`). Use **one currency per business** rather than per item: totals can't add CAD and USD without exchange rates. Not needed for D2.
- Confirm: Diana, Aidan

**Q7. Deleting items.** The Lucidchart deactivates old items (grayed out) rather than deleting them.

- Recommendation: `DELETE /api/items/{id}` sets `active = false`. Hard deletes aren't exposed. Past sales keep pointing at the item, and analytics keeps its history.
- Note: the current React client has delete and bulk delete buttons; they'd become "deactivate".
- Confirm: Diana, Allie

**Q8. Item types, sizes, and other Lucidchart item fields** (type, size W × H + unit, currency).

- Recommendation: after D2, in Diana's migration. Not needed for any D2 user story.
- Confirm: Diana

**Q9. `tags` and `note` on items.** The React client has them; the Lucidchart doesn't.

- A: keep them (Postgres `TEXT[]` for tags, or an `item_tags` table)
- B: drop them from the client and replace tags with item types (Q8)
- Recommendation: **B**. Types cover the same need and match the Lucidchart.
- Confirm: Diana, Allie

### Sales

**Q10. Sale total.** The Lucidchart calculates totals for in-person and miscellaneous sales, but has a typed-in total for Online Shop sales (platform fees and discounts make calculating it impossible).

- Recommendation: D2 always calculates `total_cents` from the lines. A manual-total option for online sales comes later, together with monthly online logging.
- Confirm: Minh

**Q11. Price override, free, and trade.** The Lucidchart lets each sale line change its price, or mark it free or traded.

- Recommendation: D2 supports a price override per line (`unitPriceCents` in the request, defaulting to the item's price). Free = override to 0. A separate "trade" flag (so analytics can tell trades from free gifts) comes later.
- Confirm: Minh

### Project setup

**Q12. Branching.** Will `claude-demo` be merged into `main`? The Java backend is planned on `claude-demo` because the React client lives there.

- Confirm: Hans

**Q13. Neon and Render ownership.** Who creates the Neon project and the Render service, and who gets dashboard access?

- Recommendation: Jinuo creates both and invites the team.
- Confirm: team

**Q14. Lucidchart in the repo.** Export the Lucidchart to `docs/data-model.pdf` so the design doc, and anyone prompting Claude with it, can reference the source.

- Confirm: Diana

### API and scope

**Q15. Tags on sales.** The React client already shows and edits tags on sales; the Lucidchart doesn't mention them.

- A: keep `tags` on sales as a Postgres `TEXT[]` column (current Hibernate maps it to `List<String>` directly)
- B: drop them; channel and storefront cover the grouping the Lucidchart needs
- Recommendation: **A** for D2, so the existing Sales page works unchanged. Revisit with Q9 so items and sales handle tags the same way.
- Confirm: Minh

**Q16. Expenses in the Java backend.** Hans added an Expenses page and API to the Node demo (lines either restock an item or record a free-text cost). No D2 user story covers it.

- A: port it to Java after D2, together with Lucidchart fields (category, manufacturer)
- B: port it for D2, since the frontend already exists
- Recommendation: **A**. D2 is graded on US1–US3; porting Expenses also means reworking how stock is tracked (Q5). If the team wants it in the D2 demo, it needs an owner.
- Confirm: Hans, team

**Q17. Time zone for dates.** "Sales on Oct 18" and the daily analytics buckets depend on a time zone: a sale at 9 PM Toronto time is already Oct 19 in UTC.

- Recommendation: store timestamps in UTC (`TIMESTAMPTZ`). Interpret date filters and group analytics in a fixed **`America/Toronto`** zone for D2; later, a per-business time zone setting.
- Confirm: Aidan, Kimberly


## 15. Build order

1. Generate the project (start.spring.io), add the wrapper, `compose.yaml` and `application.yml`. The app starts and connects.
2. Flyway + `V20261015_1__create_businesses_and_items.sql`.
3. `common/`: `ApiError`, `GlobalExceptionHandler`, `NotFoundException`, `Paginated`, `PageQuery`.
4. `HealthController`.
5. `items` example module.
6. Testcontainers base class + `ItemControllerTest`.
7. Run `demo/client` against it and confirm the Inventory page loads.
8. Dockerfile + SPA forwarding; deploy to Render with Neon.
9. `backend/README.md`; open a PR for review.
