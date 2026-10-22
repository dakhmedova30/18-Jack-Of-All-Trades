# Implementation Plan: US1 Sales (Java backend)

**For:** Claude (or a teammate) building the Sales module task by task.
**Specs:** [`../api-contracts.md`](../api-contracts.md) §1 and §4 (what the API must do) and [`../backend-skeleton-design.md`](../backend-skeleton-design.md) §4–§5 (tables and stock rules). Reference implementation: `demo/server/src/modules/sales` on `claude-demo`, plus sorting and `month-summary` from `origin/merge-ui-mods`.
**Branch:** a new branch off `backend-conversion` (e.g. `us1-sales`) · **Owner:** Jinuo · **Target:** Oct 22–23 (D2 is due Oct 23)

## Goal

All seven endpoints in contract §4 behave **exactly as the contract says**, scoped to the logged-in business, with stock kept correct even when two requests sell the same item at the same time:

| Method | Path |
| --- | --- |
| `GET` | `/api/sales` (page, pageSize, search, sort, order) |
| `GET` | `/api/sales/month-summary` |
| `GET` | `/api/sales/{id}` |
| `POST` | `/api/sales` |
| `PATCH` | `/api/sales/{id}` (replaces the whole sale) |
| `DELETE` | `/api/sales/{id}` |
| `POST` | `/api/sales/bulk-delete` |

## Rules for whoever executes this plan

The skeleton plan's rules all apply: the contract is the spec; build only what's listed; don't modify `demo/`; verify every task; commit per task; don't push without asking. In addition:

1. **Follow the `items` pattern** (README, "Adding a module"): a repository that extends the bare `Repository` interface, with only business-scoped methods; `CurrentBusiness.id()` in the service; `JdbcClient` for the list; `Ids.parse` for path ids; tests on `PostgresTestBase`.
2. **Where the contract is silent, copy the demo.** That covers validation messages, sort tie-breaks and bulk-delete semantics; they are listed below so you don't have to dig.
3. **Touching `items/` and `common/`** (Tasks 2 and 3) is shared territory with US2 (Diana) and US5. Keep those changes small and tell the team in Discord before merging, to avoid conflicts.
4. **No attribution lines** in commit messages.

## Out of scope

- **Sales channel (Q23):** not in the contract. Add it only if the team decides it and updates the contract first (see "If Q23 is decided" at the end).
- **Demo sample sales in the seeder:** unassigned in the design doc.
- **Item create/update/delete, `insights`, `low-stock`:** US2. (`insights` reads `sale_items`, so US2 needs Task 1's migration.)

---

## Task 1: Migration

Create `db/migration/V20261022_1__create_sales.sql` with the `sales` and `sale_items` tables and their four indexes, **copied from design doc §4**. The essentials:

- **`sales`:** `business_id`, `sold_at`, `tags`, timestamps.
- **`sale_items`:**
  - `item_id` is nullable and declared `ON DELETE SET NULL`, so sales history survives when an item is deleted.
  - `item_name` and `unit_price_cents` are snapshots taken at sale time.
  - `total_cents` is stored per line.
  - The sale's total is **not stored**; it's the sum of its lines.

**Verify:** `./mvnw test` passes (Flyway applies the migration in the test container). Then start the app against local Postgres; `\d sale_items` in `docker compose exec postgres psql -U jack jack` shows the FK with `ON DELETE SET NULL`.

**Commit:** `Add sales and sale_items migration`

## Task 2: Shared input rules (`common/api`)

Sales, items (US2) and expenses (US5) need the same two rules, so they belong in `common/api`, not in `sales/`. **Before starting, check with Diana whether US2 has already added these; if so, reuse hers.**

1. **`@IsoOffsetDateTime`:** a Bean Validation annotation for a `String` field. It's valid when `OffsetDateTime.parse(value)` (`ISO_OFFSET_DATE_TIME`) succeeds; `null` counts as valid, so pair it with `@NotNull`. The message is `Enter a date and time with a time zone offset`.
   - **Why a `String` and not `OffsetDateTime` in the DTO?** If Jackson fails to parse a timestamp, the error becomes `400 Request body is not valid JSON` with no `details`. The contract's rule is a validation error with `field: "soldAt"`, as the demo gives.
2. **Tags (contract §3: ≤ 10 tags, each 1–30 characters, duplicates removed, default `[]`).** Two parts:
   - On the DTO field: `@Size(max = 10, message = "At most 10 tags") List<@NotBlank(message = "Tags cannot be empty") @Size(max = 30) String> tags`.
   - A static `Tags.normalize(List<String>)` that returns an empty list for `null`, trims each tag, and removes duplicates while keeping order. Call it from the record's compact constructor, as `RegisterRequest` trims its fields, so validation sees the trimmed values.

**Verify:** a small `@SpringBootTest`-free unit test for `IsoOffsetDateTime` (accepts `2026-10-18T15:30:00-04:00` and `…Z`; rejects `2026-10-18T15:30:00` and `yesterday`) and for `Tags.normalize` (`[" a ", "a", "b"]` becomes `["a", "b"]`; `null` becomes `[]`).

**Commit:** `Add shared timestamp and tag validation`

## Task 3: Entities and repositories

**`sales/Sale`** (entity) mirrors `items/Item`:
- `businessId` with `updatable = false`, plus `soldAt` (`Instant`) and `tags`;
- `@CreationTimestamp` / `@UpdateTimestamp`;
- `@OneToMany(mappedBy = "sale", cascade = ALL, orphanRemoval = true) @OrderBy("id") List<SaleLine> lines`;
- `replaceLines(...)` clears and re-adds the lines, which is what the PATCH needs.

**`sales/SaleLine`** (entity for `sale_items`) has `@ManyToOne(fetch = LAZY) sale`, `Integer itemId` (nullable), `itemName`, `quantity`, `unitPriceCents` and `totalCents`.

**`sales/SaleRepository extends Repository<Sale, Integer>`** declares only:
- `save`;
- `delete`;
- `findByIdAndBusinessId`;
- `@Lock(PESSIMISTIC_WRITE) findLockedByIdAndBusinessId`, used for update and delete (see "Why the locks" below);
- `@Lock(PESSIMISTIC_WRITE) findLockedByIdInAndBusinessIdOrderByIdAsc(Collection<Integer> ids, Integer businessId)`, used for bulk delete.

**Small additions to `items/`** (coordinate with Diana):
- `Item.adjustQuantity(int delta)`;
- `ItemRepository`: `@Lock(PESSIMISTIC_WRITE) List<Item> findLockedByIdInAndBusinessIdOrderByIdAsc(Collection<Integer> ids, Integer businessId)`.

### Why the locks

The demo reads the stock, then updates it, without a lock. If two sales of the last unit arrive at once, both pass the "enough stock" check. The database `CHECK (quantity >= 0)` then rejects one of them, but its message is only the generic "Not enough stock". There's a worse race when a sale is deleted twice at once: both deletes restore its stock, so the stock counts the units twice.

Locking fixes both:
- Lock the **sale row**, then the **item rows in ascending id order**. Every write takes locks in that same order, so two writes can't deadlock.
- Keep the `CHECK` constraint as a backstop. `GlobalExceptionHandler` already maps it to `Not enough stock`.

**Verify:** `./mvnw test` passes. That means the app context starts, and with `ddl-auto: validate`, a mismatch between an entity and the table fails here.

**Commit:** `Add Sale entities and business-scoped repositories`

## Task 4: Read endpoints (list and get)

**DTOs (records):**
- `SaleResponse(id, soldAt, tags, totalCents, items, createdAt, updatedAt)`;
- `SaleLineResponse(id, itemId, itemName, quantity, unitPriceCents, totalCents)`, where `itemId` is `null` after the item is deleted;
- `totalCents` is the sum of the lines (`long` internally; check it fits an `int` or return it as `long`).

**`SaleQueries` (`JdbcClient`), following `ItemQueries`:**
- **Count and page:**

  ```sql
  WHERE s.business_id = :businessId
    [AND (array_to_string(s.tags, ' ') ILIKE :pattern
          OR EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id AND si.item_name ILIKE :pattern))]
  ORDER BY <whitelisted> <ASC|DESC> NULLS LAST, s.id DESC
  LIMIT :limit OFFSET :offset
  ```

  The whitelisted sort expressions, copied from `merge-ui-mods`:

  | `sort` | SQL expression |
  | --- | --- |
  | `soldAt` | `s.sold_at` |
  | `id` | `s.id` |
  | `total` | `(SELECT COALESCE(SUM(si.total_cents), 0) FROM sale_items si WHERE si.sale_id = s.id)` |
  | `tags` | `lower(s.tags[1])` |

  The defaults are `sort=soldAt` and `order=desc`. Untagged sales sort last in both directions. The tie-break is `id DESC`, as in the demo; items use `id ASC`, and that's intended.
- **Lines:** load all the page's lines in **one** query, `SELECT … FROM sale_items WHERE sale_id IN (:ids) ORDER BY id`, and group them in Java. Don't run one query per sale.

**Service and controller:**
- `GET /api/sales` uses the same parameter validation as `ItemController`: `sort` is matched by `@Pattern("id|soldAt|total|tags")`, and `order` by `asc|desc`.
- `GET /api/sales/{id}` uses `Ids.parse(raw, "sale id")`; not found or another business's id gives `404 Sale 7 not found`.

**Tests (`SaleControllerTest`; insert sales via `JdbcClient`, as `ItemControllerTest` does):**
- 401 without login;
- empty list → `totalPages: 1`;
- paging;
- search by tag and by line item name; `%` matched literally;
- each sort field in both orders, untagged sales last;
- another business's sales are neither listed nor gettable (404);
- `GET /abc` → 400 `Invalid sale id: "abc"`.

**Commit:** `Add sale list and detail endpoints`

## Task 5: Record a sale (`POST`)

**`SaleInput` record:**
- `@NotNull @IsoOffsetDateTime String soldAt`;
- tags as in Task 2;
- `@NotNull @Size(min = 1, max = 50) List<@NotNull @Valid SaleLineInput> items`, with the messages `A sale needs at least one item` and `At most 50 line items`.

`SaleLineInput(@NotNull @Positive Integer itemId, @NotNull @Positive Integer quantity)`.

**`SaleService.record(input)`, `@Transactional`:**
1. Lock the referenced items with `findLockedByIdInAndBusinessIdOrderByIdAsc(distinct itemIds, businessId)`.
2. Process the lines **in input order**. For each line:
   - if its item wasn't found → `400 Item N does not exist` (this covers another business's item);
   - if `item.getQuantity() < quantity` → `400 Not enough stock for "X" (have A, need B)`;
   - otherwise `item.adjustQuantity(-quantity)` and snapshot the name, price and `totalCents`.

   The same item can appear on two lines. Because the lines are processed in order, the second line sees the stock left after the first, as in the demo.
3. Compute `totalCents` with `Math.multiplyExact(unitPriceCents, quantity)`. If it overflows, throw `400 Number is out of range`; a plain `int` multiplication would silently wrap around. The demo gets the same message from Postgres.
4. Save the sale with `soldAt = OffsetDateTime.parse(input.soldAt()).toInstant()`; it's returned in UTC with a `Z`. Respond 201 with `SaleResponse`.

Any exception rolls back the whole transaction, so "nothing is saved" holds automatically.

**Tests:**
- 201 with the exact JSON, including line prices copied from the item;
- stock goes down;
- changing the item's price later doesn't change the sale;
- not enough stock → exact message, stock unchanged, no sale row;
- another business's item → `400 Item N does not exist`;
- the same item on two lines;
- validation errors with dotted paths:
  - `items.1.quantity`;
  - `soldAt` without an offset;
  - `items: []`;
  - a 31-character tag;
- `tags` omitted → `[]`;
- **concurrency:** two threads each sell the last unit; exactly one gets 201, the other 400, and the stock ends at 0. Use an `ExecutorService` and a `CountDownLatch` with two MockMvc calls, each with its own session cookie for the same business.

**Commit:** `Record sales with stock checks`

## Task 6: Replace and delete

- **`PATCH /api/sales/{id}`** (`@Transactional`) takes the same `SaleInput`.
  1. Lock the sale with `findLockedByIdAndBusinessId`; if it's missing → 404.
  2. Lock every item referenced by the old **and** new lines, in id order.
  3. Restore the old lines; lines with `itemId == null` are skipped.
  4. Apply the new lines with the same logic as Task 5, then `replaceLines`.
  5. Return 200. A failure rolls back everything, including the restore.
- **`DELETE /api/sales/{id}`:** lock the sale, restore its stock, delete it, return 204. Missing or another business's sale → 404.
- **`POST /api/sales/bulk-delete`** with `{ "ids": [...] }`:
  - validated with `@NotNull @Size(min = 1, max = 100, message = "Select at least one sale") List<@NotNull @Positive Integer>`;
  - lock the distinct ids that belong to this business, in order, restore and delete each, and return `{ "deleted": n }`;
  - unknown ids and other businesses' ids are **skipped silently**, as in the demo, not 404.

**Tests:**
- edit: stock is restored and then reapplied; editing a sale up to exactly the stock it already holds succeeds;
- an edit that fails for lack of stock changes nothing;
- delete restores stock;
- deleting a sale whose item was deleted works;
- bulk delete counts only your sales, and duplicate ids count once;
- another business's sale → 404 for both PATCH and DELETE.

**Commit:** `Add sale replace, delete and bulk delete`

## Task 7: Month summary

`GET /api/sales/month-summary`. The period is the current UTC month, `[first of month, first of next month)`.

Query, from `merge-ui-mods`:

```sql
WITH per_sale AS (
  SELECT s.id, s.sold_at, COALESCE(SUM(si.total_cents), 0) AS total_cents
  FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.business_id = :businessId AND s.sold_at >= :from AND s.sold_at < :to
  GROUP BY s.id)
SELECT COUNT(*), COALESCE(SUM(total_cents), 0) FROM per_sale;
-- largest: SELECT … FROM per_sale ORDER BY total_cents DESC, sold_at DESC, id DESC LIMIT 1
```

The response fields:
- `revenueCents` is a `long`;
- `averageSaleCents` is `Math.round((double) revenue / count)`, or `0` with no sales;
- `largestSale` is `null` with no sales;
- `periodStart` and `periodEnd` are ISO strings.

Map `/month-summary` **before** `/{id}`, or rely on Spring choosing the literal path; either way, test that it isn't parsed as an id.

**Tests:**
- with no sales: zeros and `null`;
- a sale this month counts; one at last month's end and one at next month's start don't;
- another business's sales don't count;
- the average rounds.

These tests use the real clock, so they could fail only if run across midnight at month end.

**Commit:** `Add sales month summary`

## Task 8: Hand-off

1. **Before merging:** run `./mvnw test`, then smoke-test with the Docker image as in skeleton Task 10:
   - log in as the demo account;
   - create an item directly in the database, or through US2 if it has merged;
   - record, edit and delete a sale with `curl`, and watch the stock change.
2. **README:** add `sales` to the layout list. Nothing else changes.
3. **Open a PR** into `backend-conversion` (or `claude-demo`, whichever the team uses as the integration branch) and tell Minh the endpoints are ready for the frontend rework.

**Commit:** `Document the sales module`

---

## If Q23 (sales channel) is decided

Do this only after the contract is updated. Add a migration `V2026xxxx_n__add_sale_channel.sql`:

```sql
ALTER TABLE sales ADD COLUMN channel TEXT NOT NULL DEFAULT 'IN_PERSON'
  CHECK (channel IN ('IN_PERSON','ONLINE','COMMISSION','MISC'))
```

Then:
- add `channel` to `Sale`, `SaleInput` (as an enum, so a bad value gets a validation error) and `SaleResponse`;
- add an optional `channel` filter to the list query;
- add tests for the default, a filter, and an invalid value.

This is about an hour of work, and nothing else in this plan changes.

## Definition of done

- Every endpoint in contract §4 matches the contract: status codes, JSON, messages and validation paths.
- Stock is correct after create, edit, delete and bulk delete, including under concurrent requests.
- No endpoint returns or changes another business's sales or items.
- `./mvnw test` passes, and the Docker image smoke test passes.
- `demo/` is unchanged.
