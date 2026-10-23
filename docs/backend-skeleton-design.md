# Backend Design for D2 (Spring Boot)

**Owner:** Jinuo Tao · **Status:** Draft for team review · **Updated:** 2026-10-21 · **Branch:** `backend-conversion`

## Summary

For D2 (**due Oct 23**), the team is rebuilding the backend in **Java + Spring Boot**, as planned in `planning.md`.

- **What the backend must do is fixed by [`api-contracts.md`](api-contracts.md):** every endpoint, JSON shape, validation rule and error message. The contract documents the TypeScript demo (`claude-demo` + `implement-user-login` + `merge-ui-mods`, as merged), so the Java backend is a faithful port, and the frontend reworks against the same contract.
- **This document covers how the Java backend is built:** stack, project layout, security, database, implementation notes per module, deployment, and who does what.
- **Everything builds on a shared skeleton** (project, security, database setup, error handling, tests), which comes first.
- When neither document covers something, **do what the TypeScript demo does**: it's the working reference.

## Work by user story

Work is split **by user story**, as the D2 handout recommends: each story's team owns its backend and frontend end to end, demos it, and reports on it. Owners follow the D2 split; ⚠ the Oct 12 meeting reassigned some people, so confirm in Discord (Q22).

### Shared skeleton (Jinuo), target Oct 21

- Spring Boot project, Docker Compose, error handling matching the contract, health check, test setup (§1, §2, §6)
- Accounts: `businesses` table, sessions, Spring Security, `/api/auth/*` (§3; contract §2). Every story's tests need a logged-in business, so this is part of the skeleton.
- Demo business + seeder skeleton (§6)
- Neon database + Render service (Q13)

### US1 Sales (contract §4), target Oct 22

| Part | Work | Owner |
| --- | --- | --- |
| Backend | `sales` + `sale_items`; list (sort/order/search), get, create, replace, delete, bulk delete, `month-summary`; stock rules (§4) | Jinuo |
| Frontend | Rework against the contract | Minh |

### US2 Inventory (contract §3), target Oct 22

| Part | Work | Owner |
| --- | --- | --- |
| Backend | `items` CRUD, bulk delete, sort/order, `insights`, `low-stock` | Diana |
| Frontend | Rework against the contract | Allie |

### US3 Analytics (contract §6), target Oct 22

| Part | Work | Owner |
| --- | --- | --- |
| Backend | `GET /api/analytics/summary?range`, `GET /api/analytics/inventory` (§5) | Aidan |
| Frontend | Rework against the contract | Kimberly |

### Accounts (contract §2), target Oct 22

| Part | Work | Owner |
| --- | --- | --- |
| Backend | Done in the skeleton | Jinuo |
| Frontend | Login and register pages, `/me` on startup, `401` → login | Hans |

### Expenses (contract §5; feeds US3's expense and profit totals), target Oct 22

| Part | Work | Owner |
| --- | --- | --- |
| Backend | `expenses` + `expense_items`; list, get, create, replace, delete, bulk delete, `month-breakdown`; restock rules | *Unassigned* (Hans built the TypeScript version) |
| Frontend | Rework against the contract | *Unassigned* |

### Shared finishing work, target Oct 23

| Work | Owner |
| --- | --- |
| Demo data: sample items, sales and expenses for the demo business (§6) | *Unassigned* |
| CI: backend tests on every push (§6) | *Unassigned* |
| Deploy the Java backend on Render (§6) | Jinuo |
| D2 README, `iteration-02-review.md`, individual contributions | Everyone |

## Open questions

Reply in Discord with the ID, e.g. "Q23: agree".

| # | Question | Recommendation | Confirm |
| --- | --- | --- | --- |
| Q22 | Which owners are current per story: the Oct 5 split or the Oct 12 meeting? | Confirm before starting | Team |
| Q23 | US1 requires a **sales channel**, and the contract has none (contract §8). Add it for D2? | Yes: a required `channel` (`IN_PERSON`, `ONLINE`, `COMMISSION`, `MISC`) on `Sale`/`SaleInput` plus a list filter. It's one column and one dropdown, and US1 is incomplete without it. | Team, Minh |
| Q24 | US3 asks for the **number of sales** over time and **per item**; `summary` returns revenue dollars by tag (contract §8). Add them for D2? | Yes, as extra fields on `summary` (a `salesCount` series and a `byItem` list for the range), so existing charts are unaffected | Aidan, Kimberly |
| Q13 | Who creates Neon and Render? | Jinuo creates both and invites the team | Team |
| Q12 | Will `claude-demo` / `backend-conversion` be merged into `main`? | Yes, after D2 | Hans |
| Q14 | Put the Lucidchart in the repo? | Export to `docs/data-model.pdf` | Diana |

If Q23 or Q24 are accepted, the contract is updated first, then both sides implement it.

---

## 1. Stack and project layout

| Area | Choice | Why |
| --- | --- | --- |
| Language | **Java 25** (current LTS) | Long-term support; Java 26 and 27 stop getting fixes after ~6 months |
| Framework | **Spring Boot 4.x** (latest stable from start.spring.io) | Matches `planning.md` |
| Build | **Maven** wrapper (`mvnw`, `mvnw.cmd`) | No Maven install needed; everyone uses the same version |
| Database | **PostgreSQL 17**; **Neon** (hosted), **Docker Compose** (local) | Same database everywhere; Neon's free tier doesn't expire |
| Data access | **Spring Data JPA** for single-row reads and writes; plain SQL (`JdbcClient`) for list, search and summary queries | JPA removes CRUD boilerplate; list search matches Postgres arrays (tags) and summaries need `GROUP BY` |
| Schema changes | **Flyway** migrations | Versioned SQL, run once each, in order, on startup |
| Validation | **Jakarta Bean Validation** | Annotations replace the demo's Zod schemas |
| Login | **Spring Security** + **Spring Session JDBC** | Session cookie; sessions stored in Postgres (§3) |
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
      api/        ApiError, GlobalExceptionHandler, NotFoundException, BadRequestException, Paginated, PageQuery
      security/   SecurityConfig, CurrentBusiness, BusinessPrincipal
      health/     HealthController
      web/        SpaResourceConfig
    auth/         Business, BusinessRepository, AuthController, AuthService      contract §2
    items/        Item, ItemRepository, ItemService, ItemController              contract §3
    sales/        Sale, SaleItem, …                                              contract §4
    expenses/     Expense, ExpenseItem, …                                        contract §5
    analytics/    AnalyticsController, AnalyticsService, AnalyticsRepository     contract §6
    seed/         DemoDataSeeder
  src/main/resources/
    application.yml
    db/migration/              # Flyway files (§4)
  src/test/java/ca/jackofalltrades/
    PostgresTestBase.java      # Testcontainers Postgres + "logged in as" helper
```

- **One package per feature,** so teammates edit different folders. Shared code lives only in `common/`.
- **Layers** (same as the demo's routes → service → repository):
  - **Controller:** HTTP only.
  - **Service:** rules and transactions (`@Transactional`).
  - **Repository:** database access.
  - **Entity:** a table; never returned from a controller.
  - **Response record:** exactly the JSON in the contract.
- **Mapping from the demo:** `*.routes.ts` → controller, `*.service.ts` → service, `*.repository.ts` → repository, `*.schema.ts` → request records with validation annotations.

## 2. Matching the contract in Spring

Spring's defaults differ from the demo in several places. Each of these must be handled in the skeleton, or every module's responses will be subtly wrong:

| Contract requirement | Spring default | What the skeleton does |
| --- | --- | --- |
| Errors are `{ "error": { "message", "details" } }` | Spring's own `ProblemDetail` / Whitelabel JSON | `GlobalExceptionHandler` (`@RestControllerAdvice`) builds `ApiError` for every exception |
| Validation `field` uses dots: `items.1.quantity` | `items[1].quantity` | Convert `[n]` to `.n` when building `details` |
| Duplicate email → **`400`** `An account with that email already exists` | — | `AuthService` checks first; a unique-index violation on `businesses.email` also maps to this message |
| Not logged in → `401 "Log in to continue"`; `/me` → `401 "Not logged in"` | `401` or `403` with no body | Custom `AuthenticationEntryPoint` that writes `ApiError`; `/me` handled in its controller |
| Wrong type in path (`/api/items/abc`) → `400` | `400` with Spring's format | Map `MethodArgumentTypeMismatchException` |
| Unknown `/api/...` route → `404` JSON | Whitelabel page | Map `NoResourceFoundException` for `/api/**` |
| `page` / `pageSize` 1-based, `totalPages` ≥ 1 | Spring Data pages are 0-based | `PageQuery` and `Paginated.from(page)` convert; modules never build pages by hand |
| Timestamps like `2026-10-18T19:30:00.000Z` | Varies | Serialize `Instant` in UTC as ISO-8601 |
| Money in integer cents | — | `int`/`long` fields named `…Cents`; never `double` |

Postgres constraint errors map as in the demo's `errorHandler.ts`: foreign key, unique, check and out-of-range violations → `400` with a short message; database unreachable → `503`; anything else → `500 "Internal server error"` (logged, never sent).

## 3. Accounts and security

Contract §2 defines the endpoints. In Spring:

- **One account = one business.** The `businesses` table holds the name, email and password hash; there are no separate user accounts.
- **Sessions:** Spring Security with **Spring Session JDBC**, so sessions live in Postgres and survive redeploys. The cookie is named **`jack_session`**, is `HttpOnly`, `SameSite=Lax`, and `Secure` on Render, with a 30-day max-age. Sessions expire after **30 days without activity** (the demo uses 30 days from login; this difference is deliberate and invisible to the frontend). Register and login save the login into the session explicitly and rotate the session id (protecting against session fixation); logout invalidates the session, which clears the cookie.
- **Behind Render's proxy:** `server.forward-headers-strategy: framework`, so Spring sees HTTPS and marks the cookie `Secure`.
- **CSRF protection is disabled,** as in the demo: `SameSite=Lax` already keeps other sites from sending requests with the cookie, and the contract has no CSRF header.
- **Passwords:** hashed with Spring Security's `BCryptPasswordEncoder`. (The demo uses scrypt, but no hashes are carried over because the Java backend starts with a fresh database.) Register accepts 8–200 characters; BCrypt only reads the first 72 bytes, which is acceptable.
- **Protected routes:** everything under `/api` except `/api/health` and `/api/auth/**`.
- **Who is asking:** `CurrentBusiness` returns the logged-in business's id. Services always take the id from there, never from the request.
- **Owner filtering can't be forgotten:** repositories for owned tables only offer methods that take a `businessId` (`findByIdAndBusinessId`, …); there is no unscoped `findById`. That includes every summary query (insights, low-stock, month summaries, analytics).
- **Another business's id → `404`** (or `400 "Item 7 does not exist"` for an `itemId` inside a sale or expense), exactly as for a nonexistent id.

## 4. Data model

The demo's tables (`implement-user-login` branch, `demo/server/src/db/schema.ts`), as Flyway migrations. The Spring Session tables replace the demo's own `sessions` table.

### Migration files

Flyway runs the files in `backend/src/main/resources/db/migration/` once each, in order, on startup.

- **Naming:** `V<yyyymmdd>_<n>__<description>.sql`, so two branches can't both create `V2`.
- **Never edit a merged migration;** add a new one instead.
- `out-of-order: true` lets a late-merged branch with an older date still run.
- Hibernate is set to `ddl-auto: validate`: it checks the tables but never changes them.

| File | Tables | Owner |
| --- | --- | --- |
| `V20261021_1__create_businesses_and_items.sql` | `businesses`, `items` | Jinuo (skeleton); Diana reviews `items` |
| `V20261021_2__create_spring_session.sql` | `spring_session`, `spring_session_attributes`: copied verbatim from `schema-postgresql.sql` inside the Spring Session JDBC jar, so it matches the installed version | Jinuo (skeleton) |
| `V20261022_1__create_sales.sql` | `sales`, `sale_items` | Jinuo |
| `V20261022_2__create_expenses.sql` | `expenses`, `expense_items` | Expenses owner |

### Tables

```sql
CREATE TABLE businesses (                              -- one account = one business
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,           -- stored lowercased
  password_hash TEXT        NOT NULL,                  -- BCrypt
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id      INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  note             TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_business_id ON items (business_id);
CREATE INDEX idx_items_name ON items (name);

CREATE TABLE sales (                                   -- one checkout; lines in sale_items
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  sold_at     TIMESTAMPTZ NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_business_id ON sales (business_id);
CREATE INDEX idx_sales_sold_at ON sales (sold_at);

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
  business_id INTEGER     NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  incurred_at TIMESTAMPTZ NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_business_id ON expenses (business_id);
CREATE INDEX idx_expenses_incurred_at ON expenses (incurred_at);

CREATE TABLE expense_items (   -- restock line (item_id set) or plain cost (item_id NULL, item_name = description)
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
| --- | --- | --- |
| Record sale | Each line subtracts its quantity; copies the item's current name and price | `Item N does not exist`; `Not enough stock for "X" (have A, need B)` |
| Replace sale | Restore old lines, then apply new ones | Same as record |
| Delete / bulk-delete sale | Restore each line (skips lines whose item was deleted) | — |
| Record expense | Restock lines add their quantity; plain-cost lines don't touch stock | Restocked item doesn't exist |
| Replace expense | Undo old restocks, then apply new lines | Undo would take stock below 0 |
| Delete / bulk-delete expense | Undo each restock | Same as replace |
| Delete item | Hard delete; lines keep the name, `item_id` becomes `NULL` | — |

- **First error wins:** the first failing line stops the request.
- **Concurrency:** check stock, then `UPDATE items SET quantity = quantity + :delta WHERE id = :id AND business_id = :businessId`. If two requests race, `CHECK (quantity >= 0)` makes Postgres reject the oversell; the handler maps that violation to the same `Not enough stock` style `400`.

## 5. Module implementation notes

The contract defines the endpoints; these are the computations behind them, ported from the demo.

| Endpoint | How it's computed (all scoped to the logged-in business) | Demo source |
| --- | --- | --- |
| `GET /items` sort/order | `sort` maps to a whitelisted column; never interpolate the raw parameter into SQL | `items.repository.ts` |
| `GET /items/insights` | `stockValueCents` = Σ quantity × unit price over all items; `bestSellers` = top 3 by units sold in sale lines this UTC month | `items.service.ts` |
| `GET /items/low-stock` | Items with quantity ≤ **5**; `count` = all of them, `items` = the `limit` lowest, lowest first | `items.repository.ts` |
| `GET /sales/month-summary` | This UTC month: count, revenue, `averageSaleCents` = round(revenue / count) or 0, largest sale or `null` | `sales.service.ts` |
| `GET /expenses/month-breakdown` | This UTC month: `restockCents` = lines with an item, `runningCents` = lines without; top 5 restocked items by spend | `expenses.service.ts` |
| `GET /analytics/summary` | Build the `range`'s UTC buckets; group sale and expense lines by the parent's first tag (`Untagged` if none); keep the top 3 tags by total, fold the rest into `Other`; zero-filled series aligned to `buckets` | `analytics.service.ts` |
| `GET /analytics/inventory` | Current quantity and item count by first tag; top 7, rest as `Other` (last) | `analytics.service.ts` |

The demo's `analytics.test.ts` and `items.test.ts` cover these edge cases (empty months, `Other` folding, bucket labels) and should be ported as Java tests.

## 6. Configuration, running and deployment

| Variable | Local default | On Render |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/jack` | Neon JDBC URL ending in `?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `jack` / `jack` | Neon credentials (Render secrets) |
| `SPRING_PROFILES_ACTIVE` | `demo` | `demo` for D2 (turns on the seeder) |
| `PORT` | `4000` (matches the Vite proxy) | Set by Render |

- **No secrets in git.** The local defaults only work with the Docker database.
- **Run locally** (needs JDK 25, Docker and Node 22+):

  ```bash
  cd backend && docker compose up -d && ./mvnw spring-boot:run    # Windows: mvnw.cmd; http://localhost:4000
  cd demo/client && npm install && npm run dev                   # http://localhost:5173
  ```

- **Health:** `GET /api/health` runs `SELECT 1`. Render uses it as the health check.
- **Demo data:** with the `demo` profile, `DemoDataSeeder` makes sure the demo business exists (`demo@jackofalltrades.test` / `ChangeMe123!`, as in the contract). If it has no items, the seeder adds sample items, several weeks of tagged sales and some expenses, with dates relative to today, so every dashboard shows data. Writes go through the services, so stock rules apply. It never runs in tests.
- **Tests:** `./mvnw test` (Docker must be running).
  - `PostgresTestBase` starts one Testcontainers Postgres per run, so the migrations are tested too, and provides a helper that registers a business and runs requests logged in as it.
  - Every module tests its endpoints, including "another business's id returns 404".
- **CI:** a GitHub Actions workflow runs `./mvnw test` on every push and pull request.
- **Deployment:** one Render Docker web service built from `backend/Dockerfile`:
  1. Build the React client.
  2. Build the jar, with the client copied into `static/`.
  3. Run on `eclipse-temurin:25-jre`.

  `SpaResourceConfig` serves the React files and falls back to `index.html` for any non-`/api` path that isn't a file (e.g. `/inventory`), so React Router handles it; unknown `/api` paths still get the JSON `404`. `backend/render.yaml` is the Java blueprint (`runtime: docker`, `dockerfilePath: ./backend/Dockerfile`, the environment variables above). The root `render.yaml` stays the Node demo's blueprint, which runs the live deployment; to switch to Java, point a Render service (with an empty database) at `backend/render.yaml`.

## 7. Skeleton build order (Jinuo)

The skeleton is **done** when a teammate can clone the repo and, in two commands, run a backend where register, login, `/me` and `GET /api/items` behave exactly as the contract says, scoped to the logged-in business; and the same build runs on Render against Neon.

1. Generate the project from start.spring.io (keep its generated `pom.xml` and `TestcontainersConfiguration`); add `compose.yaml` and `application.yml`. The app starts and connects.
2. Migrations: `businesses` + `items`, Spring Session tables.
3. `common/api`: `ApiError`, `GlobalExceptionHandler` with every mapping in §2, `Paginated`, `PageQuery`.
4. `common/security` + `auth/`: `SecurityConfig` (session cookie `jack_session`, 30 days, CSRF off, JSON `401`), `CurrentBusiness`, register, login, logout, me.
5. `HealthController`.
6. `items/`: entity, business-scoped repository, list and get, as the pattern for Diana.
7. `PostgresTestBase` with the login helper; tests for auth, items, `401`, another business's `404`, and the error format.
8. `DemoDataSeeder` creating the demo business.
9. Dockerfile, `SpaResourceConfig`, root `render.yaml`; deploy to Render with Neon.
10. `backend/README.md`; open a PR for review.

---

## Appendix A: Decided

| # | Question | Decision |
| --- | --- | --- |
| Q1 | US2 goal text in the D2 split duplicates US1 | Use the `planning.md` version (add and update products) |
| Q3 | Selling more than is in stock | Rejected with `400` |
| Q4 | Shared or private data | Private per business (`businesses`, `business_id`) |
| Q5 | How stock is tracked | A `quantity` column; a stock-movements ledger may come later |
| Q6 | Money | Integer cents; one currency |
| Q7 | Deleting items | Hard delete; lines keep the name |
| Q8 | Item types, sizes, currency | After D2 |
| Q9, Q15 | Tags on items and sales | Keep |
| Q10 | Sale total | Not stored; the sum of lines |
| Q11 | Price override, free, trade | Not in D2 |
| Q16 | Expenses in D2 | Full Expenses with restocking |
| Q17 | Time zone | UTC, as the demo (contract §8 lists Toronto time as an optional fix) |
| Q18 | Backend for the D2 demo | Java |
| Q19 | Stock concurrency | Check, then update, with `CHECK (quantity >= 0)` as the guarantee |
| Q20 | Demo data | Java seeder under the `demo` profile |
| Q21 | How login works | Session cookie `jack_session` (30 days), sessions in Postgres, no CSRF token (`SameSite=Lax`) |
| Q25 | API design | The contract matches the TypeScript demo as merged; the frontend reworks against it (2026-10-21) |

## Appendix B: In the Lucidchart, not in D2

Item types, sizes and currency · events (markets, conventions) linked to in-person sales · discounts, charges and tips · expense category and manufacturer · commissions · to-do list · services · item deactivation (graying out) instead of deletion · staff accounts sharing a business.
