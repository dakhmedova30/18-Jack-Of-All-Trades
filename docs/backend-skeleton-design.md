# Backend Skeleton Design (Spring Boot)

**Owner:** Jinuo Tao  
**Status:** Draft for team review  
**Date:** 2026-10-15  
**Branch:** `backend-skeleton` (from `claude-demo`)

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

### First migration: `items` (minimal)

Diana's Lucidchart data model isn't finalized, so the skeleton creates only the columns every version of Inventory and Sales needs. Diana adds the rest (tags, note, image, public visibility, …) in her own migration.

```sql
CREATE TABLE items (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name             TEXT        NOT NULL,
    quantity         INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit_price_cents INTEGER     NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_name ON items (name);
```

**Known gap:** the current React `Item` type also has `tags` and `note`. Until Diana's migration adds them, `ItemResponse` returns `tags: []` and `note: ""` so the Inventory page still renders.

## 7. Configuration

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

## 8. Health check

`GET /api/health` runs `SELECT 1` against the database:

- `200 {"status":"ok","database":"ok"}` when the database responds
- `503 {"status":"error","database":"unreachable"}` otherwise

Render uses this path as its health check.

## 9. Example module: `items` (skeleton version)

Only enough to prove the pattern and let the Inventory page load:

- `GET /api/items?page&pageSize&search`: paginated, case-insensitive name search, newest first
- `GET /api/items/{id}`: one item, or 404

Create, update, delete and bulk delete belong to Diana's Inventory work and are built on this structure.

## 10. Local development

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

## 11. Testing

- `PostgresTestBase` starts one Postgres container per test run using Spring Boot's `@ServiceConnection`, so tests never touch your local or hosted database.
- Flyway runs against that container, which means every test run also checks that the migrations apply cleanly.
- The skeleton ships with `ItemControllerTest`, which covers:
  - list returns the paginated shape
  - unknown id returns 404 in the error format
  - `pageSize=500` returns 400 with `details`
- Each module owner adds tests for their own endpoints, following the same pattern.

## 12. Deployment (Render)

One Docker web service, built from a multi-stage `backend/Dockerfile`:

1. **Node stage:** `npm ci && npm run build` in `demo/client`, which produces `dist/`
2. **Maven stage:** copies `dist/` into `src/main/resources/static/`, then runs `./mvnw package -DskipTests`
3. **Runtime stage:** `eclipse-temurin:25-jre`, running the jar

Spring serves the React files. `SpaForwardingController` forwards any non-`/api` path without a file extension (e.g. `/inventory`) to `index.html`, so React Router handles it. Unknown `/api/...` paths still return the JSON 404.

Render settings: Docker runtime, health check path `/api/health`, the three `SPRING_DATASOURCE_*` variables set as secrets. `demo/render.yaml` is updated (or a new root `render.yaml` added) to point at `backend/Dockerfile`.

## 13. Open questions

1. **Data model.** Diana's Lucidchart diagram is the source of truth for tables beyond the minimal `items`. Once shared, it should be exported to the repo (e.g. `docs/data-model.png`).
2. **Branching.** Will `claude-demo` be merged into `main`? This branch is based on it so the React client is available.
3. **Neon ownership.** Who creates the Neon project and the Render service, and who on the team gets dashboard access? (Proposed: Jinuo creates both and invites the team.)
4. **Sales channels.** Discord discussion leaned toward named storefronts (Etsy, Shopify, store location) rather than online/in-person. To be confirmed in the Sales design, not the skeleton.

## 14. Build order

1. Generate the project (start.spring.io), add the wrapper, `compose.yaml` and `application.yml`. The app starts and connects.
2. Flyway + `V20261015_1__create_items.sql`.
3. `common/`: `ApiError`, `GlobalExceptionHandler`, `NotFoundException`, `Paginated`, `PageQuery`.
4. `HealthController`.
5. `items` example module.
6. Testcontainers base class + `ItemControllerTest`.
7. Run `demo/client` against it and confirm the Inventory page loads.
8. Dockerfile + SPA forwarding; deploy to Render with Neon.
9. `backend/README.md`; open a PR for review.
