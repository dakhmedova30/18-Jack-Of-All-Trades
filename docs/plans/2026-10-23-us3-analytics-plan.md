# Implementation Plan: US3 Analytics (Java backend)

**Spec:** [`../api-contracts.md`](../api-contracts.md) §6. **Reference:** `demo/server/src/modules/analytics` on `origin/implement-user-login`.
**Branch:** `us3-analytics`, off `allie/java-expenses` (it needs both sales and expenses data) · **Owner:** Jinuo · **Due:** Oct 23

## Goal

Two read-only endpoints, scoped to the logged-in business, that behave exactly as contract §6 says:

| Endpoint | Returns |
| --- | --- |
| `GET /api/analytics/summary?range=week\|month\|ytd\|12months` | Totals, net profit, revenue and expense series by first tag (top 3 + "Other"), sales by tag |
| `GET /api/analytics/inventory` | Current stock by first tag (top 7 + "Other") |

No writes, no migrations, and no Q24 (sales counts): those can be added later without breaking anything.

## Tasks

### 1. Branch setup

Merge `origin/fix-whole-numbers` into `us3-analytics`, so the tests run with the validation fix the other branches will get.

**Verify:** `./mvnw test` passes (128 tests).

### 2. Time windows (pure logic, unit-tested)

The demo's rules, as plain Java functions that take `now`, so they can be tested without a clock:

| `range` | Buckets | Labels |
| --- | --- | --- |
| `week` | Last 7 days, ending today | `Mon`, `Tue`, … |
| `month` | Each day so far this month | `1`, `2`, … |
| `ytd` | Each month so far this year | `Jan`, `Feb`, … |
| `12months` (default) | Last 12 calendar months, ending this month | `Nov`, `Dec`, … |

- Bucket keys are `YYYY-MM-DD` or `YYYY-MM`, oldest first, in UTC.
- Labels are English, whatever the server's locale.

**Verify:** unit tests for each range, including on the 1st of a month and in January.

### 3. Summary endpoint

**`AnalyticsQueries`** (`JdbcClient`) fetches one row per sale line and per expense line in the window: date, the parent's first tag (`Untagged` if none) and total.

**`AnalyticsService`** turns those rows into the response:
- the top 3 tags by total, with the rest folded into `Other`, listed last;
- each series aligned to the buckets;
- a series appears only if it has data;
- `salesByTag` uses the same top 3 as the revenue series, largest first;
- totals and `netProfitCents` cover the selected range.

**`AnalyticsController`** handles invalid input: a bad `range` gives a 400 validation error.

**Verify:** integration tests for:
- 401 without login;
- with no data: buckets are present, series are empty, totals are 0;
- grouping by first tag, including `Untagged`;
- the top 3 tags plus `Other`;
- net profit;
- records outside the window excluded;
- another business's data excluded;
- an invalid range.

### 4. Inventory endpoint

Current stock grouped by each item's first tag, largest first. Tags past the top 7 fold into `Other`, listed last. `totalQuantity` and `totalItems` cover every item.

**Verify:** integration tests for:
- grouping;
- the top 7 plus `Other`;
- an empty inventory;
- another business's items excluded.

### 5. Smoke test and hand-off

- Run the Docker image, record a few sales and expenses, and check both endpoints with `curl`.
- Check that the frontend's Analytics page loads.
- Add `analytics/` to the README layout.
- Commit per task; don't push without asking.

## Decisions (Oct 23, Jinuo)

1. **Records dated in the future:** copy the demo. Everything from the window's start onward counts in the totals and the top-tag ranking, even if it falls after the last bucket and so doesn't appear in a chart.
2. **Ties between tags:** left unspecified, as in the demo. The tests must not depend on the order of tags with equal totals.
