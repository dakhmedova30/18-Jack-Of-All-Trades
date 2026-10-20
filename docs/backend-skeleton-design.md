# Backend Design for D2 (Spring Boot)

**Owner:** Jinuo Tao · **Status:** Draft for team review · **Updated:** 2026-10-19 · **Branch:** `claude-demo`

## Summary

We are replacing the TypeScript demo backend (`demo/server`) with Java + Spring Boot, as planned in `planning.md`, and the D2 demo on **Oct 23** runs on Java.

- **The TypeScript demo is the reference design.** Java reproduces its tables, endpoints, JSON, validation limits and business rules, so the existing React client keeps working. This document only describes what's **different or new**: private accounts with login, a sales channel, analytics, and the Spring Boot project itself. When this document is silent, do what the demo does.
- **Everyone builds on one shared skeleton** (project, security, database setup, error handling, tests, deployment), which Jinuo builds first.

## Who does what

> ⚠ Assignments follow the **Oct 5** D2 split. The **Oct 12** meeting moved people around (backend: Jinuo, Diana, Minh; frontend coding: Hans, Allie, Aidan). **Confirm the current split in Discord before starting.** Rows marked *Proposed* or *Unassigned* need a volunteer.

| Work | Spec | Owner | Target |
|---|---|---|---|
| Skeleton: project, security, `users` + sessions, error handling, health check, test setup, Docker Compose | §1–3, §6, §7 | Jinuo | Oct 20 |
| Neon database + Render service (create, invite team) | §6 | Jinuo (*Proposed*, Q13) | Oct 20 |
| Auth endpoints (`/api/auth`) | §5.1 | Jinuo, as part of the skeleton (*Proposed*: every test needs login) | Oct 20 |
| Items backend | §4, §5.2 | Diana | Oct 21 |
| Sales backend, incl. `channel` | §4, §5.3 | Jinuo | Oct 21 |
| Expenses backend, incl. restocking | §4, §5.4 | *Unassigned* (Hans built the TypeScript version) | Oct 21 |
| Analytics backend | §5.5 | Aidan | Oct 22 |
| Demo data seeder | §6 | *Unassigned* | Oct 22 |
| Login, sign-up, logout pages; `401` handling; CSRF header in `http.ts` | §5.1, §5.6 | Hans | Oct 21 |
| Sale form and list: channel dropdown, filter | §5.6 | Minh | Oct 21 |
| Analytics page on real data | §5.6 | Kimberly | Oct 22 |
| Switch Render from Node to Java; remove the Node server from deployment | §6 | Jinuo | Oct 22 |
| CI: run backend tests on every push | §6 | *Unassigned* | Oct 22 |
| D2 README, `iteration-02-review.md`, individual contributions | course handout | Everyone | Oct 23 |
| Fix the US2 goal text in the D2 split doc (Q1) | Appendix A | Diana | Oct 20 |

## Open questions

Reply in Discord with the ID, e.g. "Q17: agree".

| # | Question | Recommendation | Confirm |
|---|---|---|---|
| Q12 | Will `claude-demo` be merged into `main`? | Yes, after D2 | Hans |
| Q13 | Who creates Neon and Render? | Jinuo creates both and invites the team | Team |
| Q14 | Put the Lucidchart in the repo? | Export to `docs/data-model.pdf` | Diana |
| Q17 | Which time zone defines "a day"? A 9 PM Toronto sale is already the next day in UTC. | Store UTC; group analytics by day in `America/Toronto` | Aidan, Kimberly |
| Q22 | Which assignment split is current, Oct 5 or Oct 12? | Confirm before starting | Team |

All other design decisions are settled; see Appendix A.

---

## 1. Stack and project layout

| Area | Choice | Why |
|---|---|---|
| Language | **Java 25** (current LTS) | Long-term support; Java 26 and 27 stop getting fixes after ~6 months |
| Framework | **Spring Boot 4.x** (latest stable from start.spring.io) | Matches `planning.md` |
| Build | **Maven** wrapper (`mvnw`, `mvnw.cmd`) | No Maven install needed; everyone uses the same version |
| Database | **PostgreSQL 17**; **Neon** (hosted), **Docker Compose** (local) | Same database everywhere; Neon's free tier doesn't expire |
| Data access | **Spring Data JPA**; native SQL for analytics | JPA removes boilerplate; analytics needs `GROUP BY` |
| Schema changes | **Flyway** migrations | Versioned SQL, run once each, in order, on startup |
| Validation | **Jakarta Bean Validation** | Maps directly onto the error format (§2) |
| Login | **Spring Security** + **Spring Session JDBC** | Session cookie; sessions survive redeploys (§3) |
| Tests | **JUnit 5 + Testcontainers** | Real, throwaway Postgres for every test run |
| Hosting | **Render**, one Docker web service | One URL serves the React app and `/api` |

**Dependencies (start.spring.io):** Spring Web, Spring Data JPA, Validation, PostgreSQL Driver, Flyway Migration, Spring Security, Spring Session JDBC, Testcontainers.

```
backend/
  pom.xml, mvnw, mvnw.cmd, .mvn/
  compose.yaml                 # local Postgres on port 5433
  Dockerfile                   # builds client + backend for Render
  README.md
  src/main/java/ca/jackofalltrades/
    JackOfAllTradesApplication.java
    common/                    # shared by every module (skeleton)
      api/        ApiError, FieldError, GlobalExceptionHandler, NotFoundException, Paginated, PageQuery
      security/   SecurityConfig, CurrentUser, AppUserDetails
      health/     HealthController
      web/        SpaForwardingController
    auth/         User, UserRepository, AuthController, AuthService     (§5.1)
    items/        Item, ItemRepository, ItemService, ItemController     (§5.2)
    sales/        Sale, SaleItem, …                                     (§5.3)
    expenses/     Expense, ExpenseItem, …                               (§5.4)
    analytics/    AnalyticsController, AnalyticsRepository              (§5.5)
    seed/         DemoDataSeeder                                        (§6)
  src/main/resources/
    application.yml
    db/migration/              # Flyway files (§4)
  src/test/java/ca/jackofalltrades/
    PostgresTestBase.java      # Testcontainers Postgres + login helper
```

- **Package name** `ca.jackofalltrades`: Java packages mirror folders; a reversed domain is the convention.
- **One package per feature**, so teammates edit different folders and rarely conflict. Shared code lives only in `common/`.
- **Layers in every feature** (same as the demo's routes → service → repository):
  - **Controller:** HTTP only (read the request, validate, call the service, return a response).
  - **Service:** business rules and transactions (`@Transactional`).
  - **Repository:** database access.
  - **Entity:** maps to a table; never returned from a controller.
  - **Response record:** defines the JSON sent to the client, so changing a table never silently changes the API.

## 2. API conventions (every module)

These match the React client (`demo/client/src/api/http.ts`, `types.ts`).

- **Routes:** everything under `/api`; plural nouns; ids in the path (`/api/items/{id}`). `POST` creates (`201`), `PATCH` updates, `DELETE` returns `204`.
- **JSON:** camelCase; money is **integer cents** in fields ending in `Cents`; timestamps are ISO-8601 strings; ids are numbers.
- **Lists:** `?page=1&pageSize=10&search=…` (`page` ≥ 1; `pageSize` 1–100, default 10; `search` ≤ 100 chars). Response: `{ "data": [...], "page", "pageSize", "total", "totalPages" }`, where `totalPages` ≥ 1. Use `Paginated.from(page)`; never build it by hand.
- **Errors:** always `{ "error": { "message": "...", "details": [{ "field": "items[0].quantity", "message": "..." }] } }`. `details` appears only for validation errors, and `field` is the JSON path, so the form shows the message next to the right input. Modules **throw** (`throw new NotFoundException("Item", id)`) and never build error responses themselves.

`GlobalExceptionHandler` mapping:

| Cause | Status | Message |
|---|---|---|
| Validation failure | 400 | `Validation failed` + `details` |
| Malformed JSON body | 400 | `Request body is not valid JSON` |
| Wrong type in path or query (`/api/items/abc`) | 400 | `Invalid value for '<param>'` |
| Stock would go below 0 (`items_quantity_check` violation) | 400 | `Not enough stock` |
| Other constraint violation | 400 | short generic message, e.g. `Value is not allowed` |
| Not logged in | 401 | `Login required` |
| Missing or invalid CSRF token | 403 | `Invalid or missing CSRF token` |
| `NotFoundException`, including another account's id | 404 | e.g. `Item 7 not found` |
| Unknown `/api` route | 404 | `Route GET /api/xyz not found` |
| Email already registered | 409 | `An account with that email already exists` |
| Database unreachable | 503 | `Database is unavailable, try again shortly` |
| Anything else | 500 | `Internal server error` (logged, never sent) |

## 3. Accounts and security

**Every account sees and changes only its own data** (items, sales, expenses, analytics). New accounts start empty.

- **Login** is a **session cookie** (Spring Security). Sessions are stored in Postgres (Spring Session JDBC), so redeploys and Render's free-tier sleep don't log anyone out. Sessions expire after **7 days** of inactivity; a new session id is issued on login.
- **Cookie:** `HttpOnly`, `SameSite=Lax`, `Secure` on Render.
- **CSRF:** Spring Security sets a readable `XSRF-TOKEN` cookie; the client copies it into an `X-XSRF-TOKEN` header on every `POST`, `PATCH` and `DELETE`. Without that header, a request fails with `403`.
- **Every `/api` endpoint** except `/api/health` and `/api/auth/*` requires login (`401` otherwise).
- **Who is asking:** `CurrentUser` returns the logged-in user's id. Services always take the id from there, never from the request.
- **Owner filtering can't be forgotten:** repositories for owned tables only offer methods that take a `userId` (`findByIdAndUserId`, `findPageByUserId`, …). There is no unscoped `findById`.
- **Someone else's id → `404`,** not `403`, so ids don't reveal other accounts' data. This includes `itemId`s on sale and expense lines.
- **Passwords:** BCrypt hashes only.

## 4. Data model

Copied from `demo/server/src/db/schema.ts`, with three additions: the `users` table, `user_id` on the three top-level tables, and `sales.channel`. Line tables (`sale_items`, `expense_items`) get their owner through their parent.

### Migration files

Flyway runs the files in `backend/src/main/resources/db/migration/` once each, in order, on startup.

- **Naming:** `V<yyyymmdd>_<n>__<description>.sql`. Dates instead of 1, 2, 3 keep two branches from both creating `V2`.
- **Never edit a merged migration;** add a new one instead.
- `out-of-order: true` lets a late-merged branch with an older date still run.
- Hibernate is set to `ddl-auto: validate`: it checks the tables but never changes them.

| File | Tables | Owner |
|---|---|---|
| `V20261020_1__create_users_and_items.sql` | `users`, `items` | Jinuo (skeleton); Diana reviews `items` |
| `V20261020_2__create_spring_session.sql` | `spring_session`, `spring_session_attributes` (Spring Session's PostgreSQL schema) | Jinuo (skeleton) |
| `V20261021_1__create_sales.sql` | `sales`, `sale_items` | Jinuo |
| `V20261021_2__create_expenses.sql` | `expenses`, `expense_items` | Expenses owner |

### Tables

```sql
CREATE TABLE users (                                   -- NEW: one account = one business
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,                  -- BCrypt, never the raw password
  display_name  TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_users_email ON users (lower(email));   -- case-insensitive

CREATE TABLE items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,   -- NEW
  name             TEXT        NOT NULL,
  quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  note             TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_user_name ON items (user_id, name);

CREATE TABLE sales (                                   -- one checkout; lines in sale_items
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,         -- NEW
  sold_at    TIMESTAMPTZ NOT NULL,
  channel    TEXT        NOT NULL
             CHECK (channel IN ('IN_PERSON', 'ONLINE', 'COMMISSION', 'MISC')),    -- NEW (US1)
  tags       TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_user_sold_at ON sales (user_id, sold_at);

CREATE TABLE sale_items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id          INTEGER NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
  item_id          INTEGER REFERENCES items (id) ON DELETE SET NULL,   -- history survives item deletion
  item_name        TEXT    NOT NULL,                                   -- snapshot at sale time
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_cents      INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0)
);
CREATE INDEX idx_sale_items_sale_id ON sale_items (sale_id);
CREATE INDEX idx_sale_items_item_id ON sale_items (item_id);

CREATE TABLE expenses (                                -- a supplier order or a bill
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users (id) ON DELETE CASCADE,        -- NEW
  incurred_at TIMESTAMPTZ NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_user_incurred_at ON expenses (user_id, incurred_at);

CREATE TABLE expense_items (   -- restock line (item_id set) or free-text cost (item_id NULL, item_name = description)
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

- A sale's or expense's `totalCents` isn't stored; it's the sum of its lines.
- `updated_at` is set by Hibernate (`@UpdateTimestamp`).
- `TEXT[]` maps to `List<String>` with `@JdbcTypeCode(SqlTypes.ARRAY)`.

### Stock rules (same as the demo)

Each write is one `@Transactional` service call: stock and the sale or expense change together or not at all.

| Action | Stock effect | Rejected when |
|---|---|---|
| Record sale | Each line subtracts its quantity; copies the item's current name and price | Item not found (or another account's); not enough stock |
| Edit sale | Restore old lines, apply new ones (all lines replaced) | Same as record |
| Delete / bulk-delete sale | Restore each line (skips lines whose item was deleted) | — |
| Record expense | Restock lines add their quantity; free-text lines don't touch stock | Restocked item not found |
| Edit expense | Undo old restocks, apply new lines | Undo would take stock below 0 ("some may have already been sold") |
| Delete / bulk-delete expense | Undo each restock | Same as edit |
| Delete item | Hard delete; lines keep the name, `item_id` becomes `NULL` | — |

- **Prices:** a sale line always uses the item's current price; there are no overrides.
- **First error wins:** the first failing line stops the request with a 400 naming the item, e.g. `Not enough stock for "Flower Print" (have 1, need 2)`.
- **Concurrency:** check stock, then `UPDATE items SET quantity = quantity + :delta WHERE id = :id AND user_id = :userId`. If two requests race, `CHECK (quantity >= 0)` makes Postgres reject the oversell, and the error handler turns that into `Not enough stock`.

## 5. API

Same endpoints and JSON as the demo (`demo/server/src/modules/*/…routes.ts`, `demo/client/src/types.ts`), plus what's listed here. All data endpoints require login (§3).

### 5.1 Auth: `/api/auth` (new)

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password, displayName }` | `201` `User`, and logged in | `400`; `409` email taken |
| POST | `/api/auth/login` | `{ email, password }` | `200` `User` | `401` `Invalid email or password` |
| POST | `/api/auth/logout` | — | `204` | — |
| GET | `/api/auth/me` | — | `200` `User` (also sets the CSRF cookie) | `401` |

`User`: `{ "id": 3, "email": "allie@example.com", "displayName": "Allie" }`

- **Validation:** `email` valid, ≤ 254 chars, matched case-insensitively; `password` 8–72 chars (BCrypt ignores anything past 72 bytes); `displayName` optional, ≤ 60 chars.
- **Login errors never say which part was wrong**, so the form can't reveal which emails are registered.
- **The client calls `GET /api/auth/me` on startup:** `200` shows the app, `401` shows the login page.

### 5.2 Items: `/api/items` (unchanged from the demo)

`GET` list (`search` matches name or tags; ordered by `id` ascending) · `GET /{id}` · `POST` → `201` · `PATCH /{id}` (any subset, at least one field) · `DELETE /{id}` → `204` · `POST /bulk-delete` `{ ids }` (1–100) → `{ deleted }`.

```json
{ "id": 7, "name": "Flower Print", "quantity": 10, "unitPriceCents": 1200, "tags": ["print"], "note": "",
  "createdAt": "2026-10-19T20:00:00Z", "updatedAt": "2026-10-19T20:00:00Z" }
```

Input: `name` 1–120 chars (trimmed); `quantity`, `unitPriceCents` whole numbers ≥ 0; `tags` ≤ 10, each 1–30 chars, duplicates removed; `note` ≤ 1000 chars.

### 5.3 Sales: `/api/sales` (demo + `channel`)

`GET` list (`search` matches tags or line item names; new `channel` filter; newest `soldAt` first) · `GET /{id}` · `POST` → `201` · `PATCH /{id}` (**replaces** the whole sale and its lines) · `DELETE /{id}` → `204` · `POST /bulk-delete` → `{ deleted }`.

```json
{
  "id": 42, "soldAt": "2026-10-18T15:30:00Z", "channel": "IN_PERSON", "tags": [], "totalCents": 3500,
  "items": [
    { "id": 101, "itemId": 7, "itemName": "Flower Print", "quantity": 2, "unitPriceCents": 1200, "totalCents": 2400 },
    { "id": 102, "itemId": 9, "itemName": "Flower Keychain", "quantity": 1, "unitPriceCents": 1100, "totalCents": 1100 }
  ],
  "createdAt": "2026-10-18T15:31:02Z", "updatedAt": "2026-10-18T15:31:02Z"
}
```

Input: `{ "soldAt": "2026-10-18T15:30:00-04:00", "channel": "IN_PERSON", "tags": [], "items": [{ "itemId": 7, "quantity": 2 }] }`

- `soldAt`: ISO-8601 with an offset.
- `channel` (**new, required**): `IN_PERSON`, `ONLINE`, `COMMISSION` or `MISC`.
- `items`: 1–50 lines, each with `quantity` ≥ 1.

### 5.4 Expenses: `/api/expenses` (unchanged from the demo)

Same endpoint set as Sales, ordered by newest `incurredAt`; no channel.

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

Input lines: `{ itemId: number | null, description, quantity ≥ 1, unitCostCents ≥ 0 }`. Each line needs an `itemId` (restock) **or** a non-empty `description` (≤ 120 chars).

### 5.5 Analytics: `/api/analytics` (new)

Read-only. Query parameters: `from` (default: 30 days before `to`), `to` (default: today), both inclusive dates, range ≤ 366 days. `channel` filters the sales endpoints. Days follow `America/Toronto` (Q17). Sums use `BIGINT`.

| Endpoint | Extra params | Returns |
|---|---|---|
| `GET /sales-over-time` | `interval` = `day` (default), `week`, `month` | `{ from, to, interval, points: [{ periodStart, salesCount, unitsSold, revenueCents }] }`, with every period present (zeros for empty ones) |
| `GET /sales-by-item` | `limit` (default 10, max 100) | `{ from, to, data: [{ itemId, itemName, unitsSold, salesCount, revenueCents }] }`, sorted by `unitsSold`; deleted items are grouped by name with `itemId: null` |
| `GET /summary` | — | `{ from, to, revenueCents, expensesCents, profitCents, salesCount }` for the dashboard tiles |

Definitions:

- `salesCount`: number of sales.
- `unitsSold`: sum of line quantities.
- `revenueCents`: sum of sale line totals.
- `expensesCents`: sum of expense line totals.
- `profitCents`: revenue − expenses.

### 5.6 Frontend changes

| Change | Owner |
|---|---|
| Login, sign-up and logout pages; call `GET /api/auth/me` on startup; on any `401`, go to login | Hans |
| `http.ts`: send `X-XSRF-TOKEN` (value of the `XSRF-TOKEN` cookie) on `POST`, `PATCH`, `DELETE` | Hans |
| Sale form: required channel dropdown; `types.ts`: `channel` on `Sale` and `SaleInput` | Minh |
| Sales list: show the channel; optional channel filter | Minh |
| Analytics page: replace the mock data with §5.5 | Kimberly |

Items and Expenses pages need no changes.

## 6. Configuration, running and deployment

| Variable | Local default | On Render |
|---|---|---|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/jack` | Neon JDBC URL ending in `?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `jack` / `jack` | Neon credentials (Render secrets) |
| `SPRING_PROFILES_ACTIVE` | `demo` | `demo` for D2 (turns on the seeder) |
| `PORT` | `4000` (matches the Vite proxy) | set by Render |

- **No secrets in git.** The local defaults only work with the Docker database.
- **Run locally** (needs JDK 25, Docker and Node 22+):

  ```bash
  cd backend && docker compose up -d && ./mvnw spring-boot:run    # Windows: mvnw.cmd; http://localhost:4000
  cd demo/client && npm install && npm run dev                   # http://localhost:5173
  ```

- **Health:** `GET /api/health` runs `SELECT 1`. It returns `200 {"status":"ok","database":"ok"}`, or `503` with `"database":"unreachable"`. Render uses it as the health check.
- **Demo data:** with the `demo` profile and an empty database, `DemoDataSeeder` creates a demo account (credentials in `backend/README.md`) with ~20 items, ~6 weeks of sales across all four channels (dated relative to today) and a few expenses. It writes through the services, so stock rules apply. It never runs in tests.
- **Tests:** `./mvnw test` (Docker must be running). `PostgresTestBase` starts one Testcontainers Postgres per run, so migrations are tested too, and provides a helper that creates a user and runs requests logged in as them. Every module adds tests for its endpoints, including "another account's id returns 404".
- **CI:** a GitHub Actions workflow runs `./mvnw test` on every push and pull request.
- **Deployment:** one Render Docker web service built from `backend/Dockerfile` in three stages: build the React client → build the jar with the client copied into `static/` → run on `eclipse-temurin:25-jre`. `SpaForwardingController` sends non-`/api` paths without a file extension (e.g. `/inventory`) to `index.html`. `render.yaml` points at `backend/Dockerfile`, and once Java reaches parity the Node server is no longer deployed.

## 7. Skeleton build order (Jinuo)

The skeleton is **done** when a teammate can clone the repo and, in two commands, run a backend where sign-up, login and `GET /api/items` work (via `curl` or tests), scoped to the logged-in account; and the same build runs on Render against Neon.

1. Generate the project; add the wrapper, `compose.yaml` and `application.yml`. The app starts and connects.
2. Migrations: `users` + `items`, Spring Session tables.
3. `common/api`: `ApiError`, `GlobalExceptionHandler`, `NotFoundException`, `Paginated`, `PageQuery`.
4. `common/security` + `auth/`: `SecurityConfig` (session, CSRF, `401` entry point), `CurrentUser`, sign-up, login, logout, me.
5. `HealthController`.
6. `items/`: entity, owner-scoped repository, `GET` list and `GET /{id}` as the pattern for Diana.
7. `PostgresTestBase` with the login helper; tests for auth, items, `401`, and another account's `404`.
8. Dockerfile + SPA forwarding; deploy to Render with Neon.
9. `backend/README.md`; open a PR for review.

---

## Appendix A: Decided

Guiding rule: **match the `claude-demo` TypeScript design unless it's clearly harmful.**

| # | Question | Decision |
|---|---|---|
| Q1 | US2 goal text in the D2 split duplicates US1 | Use the `planning.md` version (add and update products) |
| Q2 | What a sales channel is | `IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC` (the Lucidchart's four sale types); no storefront name for D2 |
| Q3 | Selling more than is in stock | Rejected with a 400 (as the demo) |
| Q4 | Shared or private data | Private per account; one account = one business |
| Q5 | How stock is tracked | A `quantity` column (as the demo); a stock-movements ledger may come later |
| Q6 | Money | Integer cents; one currency |
| Q7 | Deleting items | Hard delete; lines keep the name (as the demo) |
| Q8 | Item types, sizes, currency | After D2 |
| Q9 | `tags` and `note` on items | Keep (as the demo) |
| Q10 | Sale total | Not stored; the sum of lines (as the demo) |
| Q11 | Price override, free, trade | Not in D2 |
| Q15 | Tags on sales | Keep (as the demo; the frontend needs them) |
| Q16 | Expenses in D2 | Full Expenses with restocking (as the demo); feeds analytics expenses and profit |
| Q18 | Backend for the D2 demo | Java |
| Q19 | Stock concurrency | Demo approach plus `CHECK (quantity >= 0)` as the guarantee |
| Q20 | Demo data | Java seeder under the `demo` profile |
| Q21 | How login works | Session cookie, sessions in Postgres, CSRF cookie + header |

## Appendix B: In the Lucidchart, not in D2

Item types, sizes and currency · events (markets, conventions) linked to in-person sales · discounts, charges and tips · expense category and manufacturer · commissions · to-do list · services · item deactivation (graying out) instead of deletion · staff accounts sharing a business.
