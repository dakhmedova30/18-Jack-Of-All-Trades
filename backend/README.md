# Jack of All Trades: Java backend

A Spring Boot 4 backend for the D2 rebuild. It serves `/api` (spec: [`docs/api-contracts.md`](../docs/api-contracts.md)) and, when deployed, the built React app. For the reasoning behind the design, see [`docs/backend-skeleton-design.md`](../docs/backend-skeleton-design.md).

## Prerequisites

- **JDK 25.** Check with `java -version`. If `./mvnw` can't find Java, set `JAVA_HOME` to the JDK folder, e.g. `C:\Program Files\Java\jdk-25…`.
- **Docker Desktop, running.** Needed for both the local database and the tests.
- **Node 22+.** Needed only to run the React client.

Maven doesn't need to be installed: `./mvnw` downloads it. On Windows, use `mvnw.cmd` in cmd/PowerShell, or `./mvnw` in Git Bash.

## Run locally

```bash
cd backend
docker compose up -d          # Postgres 17 on localhost:5433 (db/user/password: jack)
./mvnw spring-boot:run        # http://localhost:4000, migrations run on startup
```

Check that it's up: `curl http://localhost:4000/api/health` should return `{"status":"ok","database":"ok"}`.

To run the React client against this backend, start it in a second terminal:

```bash
cd demo/client
npm install
npm run dev                   # http://localhost:5173, proxies /api to port 4000
```

### Demo login

Start the backend with the `demo` profile to create the demo business:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=demo
```

Then log in as `demo@jackofalltrades.test` / `ChangeMe123!`. No sample items, sales or expenses are seeded yet.

## Run the tests

```bash
./mvnw test
```

Docker must be running. Testcontainers starts one throwaway Postgres for the whole run, and all migrations are applied to it, so the migrations are tested too. Your local database isn't touched.

## Environment variables

| Variable | Local default | On Render |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5433/jack` | Neon JDBC URL ending in `?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME` / `_PASSWORD` | `jack` / `jack` | Neon credentials (Render secrets) |
| `SPRING_PROFILES_ACTIVE` | none | `demo` (creates the demo business) |
| `PORT` | `4000` | Set by Render |

**Never commit real credentials.** The defaults only work with the Docker database.

## Docker image

Build from the **repo root**, not from `backend/`, because the image also builds `demo/client`:

```bash
docker build -f backend/Dockerfile -t jack .
docker run --rm -p 4000:4000 -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/jack jack
```

Render builds the same image from the root `render.yaml`.

## Layout

```
src/main/java/ca/jackofalltrades/
  auth/      register, login, logout, me; Business entity
  items/     inventory CRUD, insights and low-stock (the pattern to copy); writes lock the items they change
  channels/  sales channels; new businesses get four starter channels
  sales/     sales with stock checks; writes lock the sale, then its items in id order
  expensetags/ the expense form's tag choices; new businesses get five starter tags
  expenses/  expenses whose item lines restock inventory; writes lock the expense, then its items in id order
  common/    api/ (error format, pagination, shared validation), security/, health/, web/ (React fallback)
  seed/      demo-profile data
src/main/resources/db/migration/   Flyway SQL migrations
src/test/java/.../PostgresTestBase  base class for integration tests
```

## Adding a module (e.g. sales, expenses)

Copy the `items` package. In particular:

1. **Migration.** Add one new file in `db/migration/`, named `V<yyyymmdd>_<n>__<what>.sql`, e.g. `V20261022_1__create_sales.sql`.
   - Every table a business owns has `business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`, plus an index starting with `business_id`.
   - Never edit a migration that has already been merged; add a new one instead.
   - Date-based names let two people add migrations in parallel (`out-of-order` is on).
2. **Entity.** It must match the table exactly. Hibernate runs with `ddl-auto: validate`, so any mismatch stops the app at startup.
3. **Repository.** Extend `Repository<T, Integer>`, not `JpaRepository`. Declare only methods that take `businessId`, e.g. `findByIdAndBusinessId`. Then no unscoped `findAll` or `findById` exists to be called by mistake.
4. **Service.** Get the business with `CurrentBusiness.id()`, and never read it from the request.
   - If an id belongs to another business, throw `NotFoundException`, i.e. a 404, not a 403.
   - For list endpoints with search and sort, use `JdbcClient`, following `ItemQueries`: whitelist sort columns and escape LIKE wildcards.
5. **Controller.** Map paths exactly as in `docs/api-contracts.md`. Parse path ids with `Ids.parse`, and put Bean Validation annotations on the DTOs and parameters. Errors are turned into the contract's format by `GlobalExceptionHandler`, so don't write error JSON yourself.
6. **Tests.** Extend `PostgresTestBase`, use `registerAndLogin()`, and cover at least:
   - the happy path;
   - validation errors;
   - 401 without a login;
   - **another business's id returns 404**.

Before pushing, run `./mvnw test`.
