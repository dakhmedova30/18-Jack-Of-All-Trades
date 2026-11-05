# Implementation Plan: Java Backend Skeleton

**For:** Claude (or a teammate) building the skeleton task by task.
**Specs:** [`../api-contracts.md`](../api-contracts.md) (what the API must do) and [`../backend-skeleton-design.md`](../backend-skeleton-design.md) (how it's built). Read both before starting.
**Branch:** `backend-conversion` · **Owner:** Jinuo · **Target:** Oct 21–22 (D2 is due Oct 23)

## Goal

A Spring Boot backend in `backend/` where `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/health`, `GET /api/items` and `GET /api/items/{id}` behave **exactly as the contract says**, scoped to the logged-in business, with tests, running locally against Docker Postgres and deployable to Render. Teammates then add Sales, Expenses, Analytics and the rest of Items on top.

## Rules for whoever executes this plan

1. **The contract is the spec.** Status codes, JSON field names, error messages and validation limits must match `api-contracts.md` exactly. If the contract is silent, do what the TypeScript demo does (`demo/server/src`). If the two disagree, or neither covers it, **stop and ask**; don't guess.
2. **Build only what's listed.** No extra endpoints, abstractions, configuration options or "future-proofing". Sales, Expenses, Analytics, item create/update/delete and sample data are **out of scope**.
3. **Don't modify anything under `demo/`.** The TypeScript app is the reference and stays untouched.
4. **Verify every task before moving on.** Each task ends with a **Verify** step. If it fails, fix it before continuing; never mark a task done on "it compiles".
5. **Commit after each task** with the message given. End each commit message with the attribution line the environment asks for. **Don't push** without asking.
6. **Spring Boot 4 specifics** (starter names, test annotation packages, Jackson 3's `tools.jackson.*` packages) may differ from older tutorials. Prefer what start.spring.io generated and what the compiler accepts; if an API in this plan doesn't exist, find its Boot 4 equivalent and note the change in the commit message.
7. **State assumptions.** When a step needs a judgment call not covered here, write the assumption in the commit message or ask.

## Prerequisites (human)

- JDK 25: `winget install EclipseAdoptium.Temurin.25.JDK`, then a new terminal: `java -version` shows 25.
- Docker Desktop running: `docker ps` works.
- On the right branch: `git switch backend-conversion && git pull`.

---

## Task 1: Generate the project

1. On https://start.spring.io choose: **Maven**, **Java**, latest stable **Spring Boot 4.x**, Group `ca.jackofalltrades`, Artifact `backend`, Name `backend`, Package name **`ca.jackofalltrades`**, Packaging **Jar**, Java **25**.
2. Dependencies: **Spring Web**, **Spring Data JPA**, **Validation**, **PostgreSQL Driver**, **Flyway Migration**, **Spring Security**, **Spring Session JDBC**, **Testcontainers**.
3. Unzip into `backend/` at the repo root (so `backend/pom.xml`, `backend/mvnw` exist). Keep the generated `pom.xml`, the main class, and the generated test classes, including `TestcontainersConfiguration` (or the equivalent start.spring.io generates for Postgres).
4. Rename the main class to `JackOfAllTradesApplication` if it was generated under another name.
5. Add `backend/.gitignore` from the generated one (it should ignore `target/`).

**Verify:** `cd backend && ./mvnw -q -DskipTests compile` (Windows: `mvnw.cmd`) succeeds.

**Commit:** `Generate Spring Boot backend project`

## Task 2: Local database and configuration

Create `backend/compose.yaml`:

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: jack
      POSTGRES_USER: jack
      POSTGRES_PASSWORD: jack
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Replace `src/main/resources/application.properties` with `application.yml`:

```yaml
server:
  port: ${PORT:4000}
  forward-headers-strategy: framework     # Render's proxy terminates HTTPS
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:postgresql://localhost:5433/jack}
    username: ${SPRING_DATASOURCE_USERNAME:jack}
    password: ${SPRING_DATASOURCE_PASSWORD:jack}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate                  # only Flyway changes the schema
  flyway:
    out-of-order: true
  session:
    timeout: 30d
    jdbc:
      initialize-schema: never            # the Flyway migration creates the tables
```

Add `src/main/resources/application-demo.yml` (empty for now except a comment); the seeder in Task 9 is enabled by this profile.

If start.spring.io added a `spring-boot-docker-compose` dependency, **remove it**: we start Docker explicitly.

**Verify:** `docker compose up -d`, then `./mvnw spring-boot:run` starts and stays up, listening on port 4000. It may log that Flyway found no migrations; that's fine. Stop it.

**Commit:** `Add local Postgres and application configuration`

## Task 3: Migrations

1. `src/main/resources/db/migration/V20261021_1__create_businesses_and_items.sql`: the `businesses` and `items` `CREATE TABLE` and `CREATE INDEX` statements **exactly as in design doc §4** (only those two tables).
2. `V20261021_2__create_spring_session.sql`: open the Spring Session JDBC jar from the Maven repository (`~/.m2/repository/org/springframework/session/spring-session-jdbc/<version>/`) and copy `org/springframework/session/jdbc/schema-postgresql.sql` **verbatim**. Don't write it from memory.

**Verify:**
- `./mvnw spring-boot:run` starts and Flyway logs both migrations as applied.
- `docker compose exec postgres psql -U jack -d jack -c '\dt'` lists `businesses`, `items`, `spring_session`, `spring_session_attributes` and `flyway_schema_history`.

**Commit:** `Add businesses, items and session migrations`

## Task 4: Shared API types and error handling (`common/api`)

Create in `ca.jackofalltrades.common.api`:

| Class | Purpose |
|---|---|
| `ApiError` | Record for `{ "error": { "message", "details" } }`. `details` is omitted from the JSON when null (use `@JsonInclude(NON_NULL)`). |
| `FieldError` | Record `{ field, message }`. |
| `NotFoundException` | `new NotFoundException("Item", 7)` → message `Item 7 not found`. |
| `BadRequestException` | `400` with a given message (e.g. `Item 7 does not exist`, `An account with that email already exists`). |
| `UnauthorizedException` | `401` with a given message. |
| `Paginated<T>` | Record `{ data, page, pageSize, total, totalPages }`; static `of(List<T> data, int page, int pageSize, long total)` computes `totalPages = max(1, ceil(total / pageSize))`. |
| `GlobalExceptionHandler` | `@RestControllerAdvice` mapping below. |

`GlobalExceptionHandler` mappings (messages exactly as written):

| Exception | Status | `message` |
|---|---|---|
| `MethodArgumentNotValidException` | 400 | `Validation failed`, with `details` from the field errors |
| `HandlerMethodValidationException` (invalid `@RequestParam`s) | 400 | `Validation failed`, with `details` using the parameter name as `field` |
| `HttpMessageNotReadableException` | 400 | `Request body is not valid JSON` |
| `MethodArgumentTypeMismatchException` | 400 | `Invalid value for '<parameter name>'` |
| `BadRequestException` / `UnauthorizedException` / `NotFoundException` | 400 / 401 / 404 | its message |
| `NoResourceFoundException` | 404 | `Route <METHOD> <path> not found`, e.g. `Route GET /api/xyz not found` |
| `DataIntegrityViolationException` | 400 | By Postgres SQL state: `23505` → `A record with that value already exists`; `23503` → `Referenced record does not exist`; `23514` → `Not enough stock` if the constraint is `items_quantity_check`, otherwise `Value is not allowed`; `22003` → `Number is out of range`; anything else → `Invalid value` |
| `DataAccessResourceFailureException` (and connection failures) | 503 | `Database is unavailable, try again shortly` |
| Any other `Exception` | 500 | `Internal server error`; log the exception, never send its details |

**Field paths:** convert Bean Validation paths to the contract's dotted form: `items[1].quantity` → `items.1.quantity` (replace `[n]` with `.n`).

Copy the demo's Postgres code table from `demo/server/src/middleware/errorHandler.ts` rather than inventing new messages.

**Verify:** `./mvnw -q -DskipTests compile` succeeds. (Behavior is tested in Task 6, once there are endpoints.)

**Commit:** `Add API error format and pagination types`

## Task 5: Security and accounts (`common/security`, `auth`)

### 5a. Entity and repository

- `auth/Business`: JPA entity on `businesses` (`Integer id` with `IDENTITY`, `name`, `email`, `passwordHash`, `createdAt`, `updatedAt` with `@CreationTimestamp` / `@UpdateTimestamp`).
- `auth/BusinessRepository`: `Optional<Business> findByEmail(String email)`, `boolean existsByEmail(String email)`.

### 5b. Security configuration (`common/security/SecurityConfig`)

- `PasswordEncoder` bean: `BCryptPasswordEncoder`.
- `SecurityFilterChain`:
  - `csrf` disabled (contract §2: no CSRF token; `SameSite=Lax` instead).
  - `formLogin`, `httpBasic` and the default `logout` disabled; login and logout are our own endpoints.
  - Authorization: `/api/health` and `/api/auth/**` permitted; any other `/api/**` requires authentication; **everything else permitted** (the React app's files).
  - `securityContext` uses `HttpSessionSecurityContextRepository` (expose it as a bean; Task 5d uses it).
  - Authentication entry point: respond `401` with `ApiError` message **`Log in to continue`**, written as JSON with the application's Jackson mapper.
- Session cookie, as a `DefaultCookieSerializer` bean: cookie name `jack_session`, `HttpOnly`, `SameSite=Lax`, max-age 30 days, path `/`. Leave `Secure` to auto-detection (it follows `request.isSecure()`, which works on Render thanks to `forward-headers-strategy`).

### 5c. Who is logged in

- `common/security/BusinessPrincipal`: record `(Integer businessId)`, used as the authentication principal.
- `common/security/CurrentBusiness`: a component with `Integer id()` that reads the principal from `SecurityContextHolder` and throws `UnauthorizedException("Log in to continue")` if there is none. Services get the business id **only** from here.

### 5d. Endpoints (`auth/AuthController`, `auth/AuthService`)

Request records with a **compact constructor that trims** strings (and lowercases `email`), so validation sees the cleaned value:

| Record | Fields and validation (messages from `demo/server/src/modules/auth/auth.schema.ts` on `origin/implement-user-login`) |
|---|---|
| `RegisterRequest` | `name`: `@NotBlank(message="Business name is required")`, `@Size(max=120)`. `email`: `@NotBlank`, `@Email(message="Enter a valid email")`, `@Size(max=255)`. `password`: `@NotNull`, `@Size(min=8, max=200, message="Password must be at least 8 characters")` (don't trim passwords) |
| `LoginRequest` | `email` as above; `password`: `@NotBlank(message="Password is required")`, `@Size(max=200)` |
| `BusinessResponse` | `{ id, name, email, createdAt }` |

Behavior:

- **`POST /api/auth/register`** → if `existsByEmail` → `BadRequestException("An account with that email already exists")`. Hash the password, save, **log in** (below), return `201` `BusinessResponse`. (The unique index also maps to `400` via Task 4 if two registrations race.)
- **`POST /api/auth/login`** → find by email; if missing or the password doesn't match → `UnauthorizedException("Incorrect email or password")`. Log in, return `200` `BusinessResponse`.
- **Logging in** (shared private method):
  1. If the request already has a session, call `request.changeSessionId()` (session-fixation protection).
  2. Create an empty `SecurityContext` and set `UsernamePasswordAuthenticationToken.authenticated(new BusinessPrincipal(id), null, List.of())`.
  3. `SecurityContextHolder.setContext(context)` **and** `securityContextRepository.saveContext(context, request, response)`. Without the explicit save, the next request is anonymous.
- **`POST /api/auth/logout`** → invalidate the session if one exists, clear the security context, return `204`.
- **`GET /api/auth/me`** → if not logged in → `UnauthorizedException("Not logged in")`; otherwise return the business. Note this endpoint is under the permitted `/api/auth/**`, so it must check login itself.

**Verify:** compiles, and the app starts.

**Commit:** `Add session-cookie login with business accounts`

## Task 6: Test base and auth tests

1. `src/test/java/ca/jackofalltrades/PostgresTestBase.java`: abstract `@SpringBootTest` + MockMvc base that imports the generated Testcontainers configuration (Postgres 17 via `@ServiceConnection`). One container per test run.
2. Helper `Cookie registerAndLogin()`: registers a business with a **unique email** (UUID-based), and returns the `jack_session` cookie from the response. Tests pass it with `.cookie(...)` on later requests, so they exercise the real cookie. Unique emails make tests independent without cleaning the database.
3. `auth/AuthControllerTest`, one test each:
   - Register → `201`, body has `id`, `name`, `email`, `createdAt`; a `jack_session` cookie is set with `HttpOnly` and `SameSite=Lax`.
   - Register with the same email again → `400` `An account with that email already exists`.
   - Register with `email: "Allie@Example.com "` → stored and returned as `allie@example.com`.
   - Register with a 7-character password → `400`, `details[0].field` = `password`.
   - Login with a wrong password → `401` `Incorrect email or password`.
   - Login → the cookie works for `GET /api/auth/me` → `200`.
   - `GET /api/auth/me` without a cookie → `401` `Not logged in`.
   - Logout → `204`; afterwards `GET /api/auth/me` with the old cookie → `401`.
   - Malformed JSON body to `/api/auth/login` → `400` `Request body is not valid JSON`.

**Verify:** `./mvnw test` passes (Docker running).

**Commit:** `Add Testcontainers test base and auth tests`

## Task 7: Health check

`common/health/HealthController`: `GET /api/health` runs `SELECT 1` with `JdbcTemplate`. Success → `200 {"status":"ok","database":"ok"}`. Any `DataAccessException` → `503 {"status":"error","database":"unreachable"}`.

**Verify:** a test asserts `200` and the body without logging in; `curl http://localhost:4000/api/health` against the running app returns the same.

**Commit:** `Add health check`

## Task 8: Items read endpoints (pattern for teammates)

Contract §3, **only** `GET /api/items` and `GET /api/items/{id}`.

1. `items/Item`: JPA entity on `items`. `tags` is `List<String>` with `@JdbcTypeCode(SqlTypes.ARRAY)`; `businessId` is a plain `Integer` column.
2. `items/ItemResponse`: record `{ id, name, quantity, unitPriceCents, tags, note, createdAt, updatedAt }`.
3. `items/ItemRepository` (Spring Data JPA): only `Optional<Item> findByIdAndBusinessId(Integer id, Integer businessId)`. **No unscoped finders**; this is the pattern every module copies.
4. `items/ItemQueries` (uses `JdbcClient`), for the list:
   - `WHERE business_id = :businessId`, plus, when `search` is present, `AND (name ILIKE :pattern OR array_to_string(tags, ' ') ILIKE :pattern)`, where `pattern = "%" + escaped + "%"` and `\`, `%` and `_` in the search text are escaped with `\` (as `escapeLikePattern` in the demo).
   - `ORDER BY <column> <direction>, id <direction>`. Map `sort` through a fixed `Map`: `id`→`id`, `name`→`name`, `quantity`→`quantity`, `unitPriceCents`→`unit_price_cents`; `order` must be `asc` or `desc`. **Never put the raw parameter into the SQL.**
   - A matching `COUNT(*)` query for `total`; `LIMIT :pageSize OFFSET (:page - 1) * :pageSize`.
5. `items/ItemService`: takes the business id from `CurrentBusiness`; `get` throws `NotFoundException("Item", id)`.
6. `items/ItemController` (`@Validated`):
   - `GET /api/items` with `@RequestParam(defaultValue="1") @Min(1) int page`, `@RequestParam(defaultValue="10") @Min(1) @Max(100) int pageSize`, optional `search` with `@Size(max=100)` (trimmed; blank means no search), `sort` default `id` and `order` default `asc`, validated against the allowed values (invalid → `400`).
   - `GET /api/items/{id}`.

**Tests** (`items/ItemControllerTest`), inserting items for each business directly with `JdbcClient`:

- List returns the `Paginated` shape; `totalPages` is `1` when empty.
- `search` matches by name and by tag, case-insensitively; a search for `%` doesn't match everything.
- `sort=quantity&order=desc` orders correctly.
- `pageSize=500` → `400`, with `details` containing `pageSize`.
- `GET /api/items/abc` → `400` `Invalid value for 'id'`.
- Another business's item → `404` `Item <id> not found`, and it never appears in the first business's list.
- No cookie → `401` `Log in to continue`.
- `GET /api/nonexistent` (logged in) → `404` `Route GET /api/nonexistent not found`.

**Verify:** `./mvnw test` passes.

**Commit:** `Add business-scoped item read endpoints`

## Task 9: Demo business

`seed/DemoDataSeeder`: an `ApplicationRunner` annotated `@Profile("demo")`. If no business has the email `demo@jackofalltrades.test`, create it with name `Demo Business` and password `ChangeMe123!` (BCrypt). Nothing else; sample items, sales and expenses belong to whoever takes the "Demo data" row in the design doc.

**Verify:**
- `SPRING_PROFILES_ACTIVE=demo ./mvnw spring-boot:run`, then log in with `curl -i -c cookies.txt -H 'Content-Type: application/json' -d '{"email":"demo@jackofalltrades.test","password":"ChangeMe123!"}' localhost:4000/api/auth/login` → `200`.
- `curl -b cookies.txt localhost:4000/api/items` → `200` with an empty page.
- Restarting doesn't create a second demo business.

**Commit:** `Seed the demo business under the demo profile`

## Task 10: Serve the React app, Docker image, Render blueprint

1. **`common/web/SpaResourceConfig`** (`WebMvcConfigurer`): register a resource handler for `/**` on `classpath:/static/` with a `PathResourceResolver` that returns the requested file if it exists; otherwise returns `static/index.html` for paths that **don't** start with `api/` and **don't** contain a `.`; otherwise returns `null` (so unknown `/api/...` paths still reach the JSON `404`).
2. **`backend/Dockerfile`**, built from the **repo root** as context:
   - Stage 1 `node:22`: copy `demo/package.json`, `demo/package-lock.json`, `demo/client/package.json`, `demo/server/package.json`; `npm ci` in `demo/`; copy `demo/client/`; `npm run build -w client` (output: `demo/client/dist`).
   - Stage 2 `eclipse-temurin:25-jdk`: copy `backend/`; copy `demo/client/dist/` into `backend/src/main/resources/static/`; `./mvnw -q -DskipTests package`.
   - Stage 3 `eclipse-temurin:25-jre`: copy the jar to `/app/app.jar`; `ENTRYPOINT ["java", "-jar", "/app/app.jar"]`.
3. A root **`.dockerignore`** excluding `**/node_modules`, `**/target`, `**/dist`, `.git`.
4. A root **`render.yaml`**:

   ```yaml
   services:
     - type: web
       name: jack-of-all-trades
       runtime: docker
       plan: free
       dockerfilePath: ./backend/Dockerfile
       dockerContext: .
       healthCheckPath: /api/health
       autoDeploy: true
       envVars:
         - key: SPRING_DATASOURCE_URL
           sync: false
         - key: SPRING_DATASOURCE_USERNAME
           sync: false
         - key: SPRING_DATASOURCE_PASSWORD
           sync: false
         - key: SPRING_PROFILES_ACTIVE
           value: demo
   ```

   Leave `demo/render.yaml` alone (rule 3).

**Verify:**
- `docker build -f backend/Dockerfile -t jack .` succeeds from the repo root.
- `docker run --rm -p 4000:4000 -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5433/jack -e SPRING_PROFILES_ACTIVE=demo jack`:
  - `http://localhost:4000/` loads the React app;
  - `http://localhost:4000/inventory` loads it too (not a `404`);
  - `/api/health` returns `200`;
  - `/api/nope` returns the JSON `404`.

**Commit:** `Serve the React app and add Docker and Render configuration`

## Task 11: README and hand-off

`backend/README.md`, short:
- Prerequisites (JDK 25, Docker, Node 22).
- Run locally (design doc §6 commands).
- Run tests.
- Demo login.
- Environment variables (table from design doc §6).
- **"Adding a module"**: copy the `items` pattern, with business-scoped repository methods only; one migration file named `V<yyyymmdd>_<n>__…`; tests including "another business's id returns 404". Link to the contract and design doc.

**Verify:** a fresh clone, following only the README, reaches a passing `./mvnw test` and a running app.

**Commit:** `Add backend README`

Then **stop and report**: what was built, the test results, any deviations from this plan and why, and anything that needs a human (below).

---

## Human steps (Jinuo), not for Claude

1. Create the Neon project. Copy the JDBC connection string (ending `?sslmode=require`), user and password.
2. In Render: **New → Blueprint**, select the repo and branch, and fill in the three `SPRING_DATASOURCE_*` secrets.
3. After the first deploy:
   - `https://<app>.onrender.com/api/health` → `200`;
   - logging in as the demo business works in the browser;
   - the cookie is `Secure` in DevTools (proves `forward-headers-strategy` works).
4. Invite the team to the Neon and Render dashboards, and post the URL in Discord.
5. Open a PR from `backend-conversion` for review.

## Definition of done

- [ ] `./mvnw test` passes: auth, health and items tests, including the cross-business `404` and the `401` checks.
- [ ] Every response in the tests matches `api-contracts.md` (status, fields, messages).
- [ ] App runs locally with `docker compose up -d && ./mvnw spring-boot:run`.
- [ ] Docker image builds and serves both the React app and `/api`.
- [ ] Deployed on Render against Neon (human steps).
- [ ] Nothing under `demo/` changed (`git diff --stat origin/claude-demo -- demo` is empty).
