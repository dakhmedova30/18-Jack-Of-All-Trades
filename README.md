# Jack-Of-All-Trades

## Description About The Project

 * Jack-Of-All-Trades is a business management and intelligence platform targeted at small businesses, entrepreneurs, and independent creators.
 * Starting out a small business may often be daunting, as you have to manage sales, track inventory, and figure out your own analytics.
 * As such, our application aims to simplify the accounting & inventory management process, as well as provide analytics and projections for business performance.
​
## Key Features
   
 * Bookkeeping Dashboard: Allows business owners to record sales.
 * Inventory Dashboard: Allows business owners to add and update inventory items.
 * Expenses Dashboard: Allows business owners to record costs, including restocking inventory.
 * Analytics Dashboard: Displays performance indicators for the business.
 * Business Profile Dashboard: Allows businesses to list their products.
 * Customer Dashboard: Allows customers to view vendors registered on the platform and make purchases.
​
## Instructions

 * Business Owners: Register a business account (name, email, password) and log in. Every dashboard below requires being logged in, and only ever shows your own business's data.
     * Bookkeeping Dashboard: Click "Add" to record a sale (one transaction). Set a date and tags, then add one or more line items (an inventory item + quantity each); the line and sale totals are computed from the item's price. Recording, editing or deleting a sale keeps inventory stock in sync automatically.
     * Inventory Dashboard: Click the "Add Item" button to add an item, set prices, and set stock count.
     * Expenses Dashboard: Click "Add" to record an expense. Set a date and tags, then add one or more lines; each line either restocks an inventory item (pick it, and its stock goes up by the quantity) or is a free-text cost like "Rent" with no stock effect. Recording, editing or deleting an expense keeps inventory stock in sync automatically.
     * Analytics Dashboard: View real revenue, expenses and net profit, computed from your sales and expenses. Revenue, expenses and sales group by each record's first tag (top 3, the rest folded into "Other"); "Show by" (Weekly / Month / Year to date / 12 months) sets the time range for all three charts together.
     * Business Profile Dashboard: Set up a public profile for customers to see.
 * Customers: Register a customer account.
     * Can browse and look up available businesses and make purchases. 
 
## Development Requirements

### Prerequisites

 * macOS, Linux or Windows
 * Git
 * [Java 25](https://adoptium.net/) (`brew install openjdk@25` on macOS) and the Maven wrapper (`backend/mvnw`, no separate Maven install needed)
 * [Node.js](https://nodejs.org/) 22.13 or newer (24 LTS works too; `nvm use` reads `.nvmrc`) and npm 10+, to build/run `demo/client`
 * A PostgreSQL database, either hosted (Neon, AWS RDS, Supabase, ...) or local (`docker compose up -d` in `backend/`)

### Tech stack

| Layer    | Technology                                                                 |
| -------- | --------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router                                  |
| Backend  | Java 25, Spring Boot 4, Spring Security, Spring Data JPA / `JdbcClient`, Flyway, BCrypt, Maven |
| Database | PostgreSQL (Neon in production)                                           |
| Hosting  | Render (one Docker web service)                                           |
| Tooling  | ESLint, Prettier (frontend); JUnit 5 + Testcontainers (backend tests)      |

### Setup

```bash
git clone <repo-url> jack-of-all-trades
cd jack-of-all-trades

# 1. Local Postgres for the backend (runs on :5433, no setup needed)
cd backend && docker compose up -d && cd ..

# 2. Backend — seeds the demo account, picks up the local Postgres above by default
cd backend && SPRING_PROFILES_ACTIVE=demo ./mvnw spring-boot:run
# in a second terminal:
cd demo && npm install && npm run dev -w client   # web app on http://localhost:5173
```

No Docker? Point the backend at any hosted Postgres instead by setting `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD` (see [Configuration](#configuration)) before `./mvnw spring-boot:run`. Flyway creates the schema automatically on first connect either way.

The app requires a login. Register your own business account on first run, or log in as the seeded demo account:

```
email:    demo@jackofalltrades.test
password: ChangeMe123!
```

Open http://localhost:5173. In development the Vite dev server forwards `/api/*` to the backend on `:4000`. In production, the backend itself serves the built React app and the API from one URL.

### Scripts

Frontend (run from `demo/`, not the repo root — there is no root `package.json`):

| Command             | What it does                      |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Runs the web app with hot reload   |
| `npm run typecheck` | Type-checks the client             |
| `npm run lint`      | Runs ESLint                        |
| `npm run format`    | Formats everything with Prettier   |
| `npm run build`     | Builds `client/dist`               |

Backend (run from `backend/`):

| Command                          | What it does                                          |
| --------------------------------- | ------------------------------------------------------ |
| `./mvnw spring-boot:run`          | Runs the API (add `SPRING_PROFILES_ACTIVE=demo` to seed the demo account) |
| `./mvnw test`                     | Runs the JUnit/Testcontainers test suite (needs Docker) |
| `./mvnw -DskipTests package`      | Builds the jar (used by `backend/Dockerfile`)           |
| `docker compose up -d`            | Starts local Postgres on `:5433` for development        |

### Project structure

```
demo/
  client/                    React app
    src/api/                 fetch wrappers, one file per resource
    src/components/          shared UI: layout, modal, pagination, icons
    src/hooks/                data-loading hooks (useItems)
    src/pages/                one folder per dashboard
    src/styles.css            design tokens + styles from the Figma wireframe
backend/                     Java/Spring Boot API
  src/main/java/ca/jackofalltrades/<feature>/   controller -> service -> repository
  src/main/resources/db/migration/              Flyway SQL migrations
  src/test/java/                                 JUnit 5 + Testcontainers tests
  compose.yaml                                    local Postgres for development
  render.yaml                                      Render deployment config
docs/
  api-contracts.md           the API contract the backend implements
```

Each feature follows the same layers: **controllers** handle HTTP only, **services** hold business rules, **repositories** hold all SQL. A new feature should copy an existing one, e.g. `backend/src/main/java/ca/jackofalltrades/items`, and should be added to `docs/api-contracts.md` to keep it accurate.

### API

See [`docs/api-contracts.md`](docs/api-contracts.md) for the authoritative, endpoint-by-endpoint spec. The summary below covers the same contract.

All error responses share one shape: `{ "error": { "message": string, "details"?: [{ "field", "message" }] } }`. Money is always sent as integer cents.

Every route except `/api/health` and `/api/auth/*` requires a logged-in session
(a cookie set by register/login) and returns 401 without one. Items, sales,
expenses, channels, expense tags and analytics are all scoped to the logged-in
business: one business can never see or modify another's data, even by
guessing an id in the URL.

| Method | Endpoint                 | Description                                |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/health`            | Health check (also checks the database)    |
| POST   | `/api/auth/register`     | Create a business account, logs you in     |
| POST   | `/api/auth/login`        | Log in (`{ email, password }`)             |
| POST   | `/api/auth/logout`       | Log out                                    |
| GET    | `/api/auth/me`           | The logged-in business, or 401             |
| GET    | `/api/items`             | List items (`page`, `pageSize`, `search`)  |
| GET    | `/api/items/:id`         | Get one item                               |
| POST   | `/api/items`             | Create item                                |
| PATCH  | `/api/items/:id`         | Update some fields of an item              |
| DELETE | `/api/items/:id`         | Delete item                                |
| POST   | `/api/items/bulk-delete` | Delete several items (`{ "ids": [1, 2] }`) |
| GET    | `/api/sales`             | List sales (`page`, `pageSize`, `search`)  |
| GET    | `/api/sales/:id`         | Get one sale                               |
| POST   | `/api/sales`             | Record a sale (decrements item stock)      |
| PATCH  | `/api/sales/:id`         | Replace a sale's date, tags and line items |
| DELETE | `/api/sales/:id`         | Delete a sale (restores item stock)        |
| POST   | `/api/sales/bulk-delete` | Delete several sales (`{ "ids": [1, 2] }`) |
| GET    | `/api/expenses`             | List expenses (`page`, `pageSize`, `search`)  |
| GET    | `/api/expenses/:id`         | Get one expense                               |
| POST   | `/api/expenses`             | Record an expense (restocks any linked items) |
| PATCH  | `/api/expenses/:id`         | Replace an expense's date, tags and lines     |
| DELETE | `/api/expenses/:id`         | Delete an expense (undoes any restock)        |
| POST   | `/api/expenses/bulk-delete` | Delete several expenses (`{ "ids": [1, 2] }`) |
| GET    | `/api/analytics/summary`    | Dashboard totals and charts (`range`, default `12months`) |

A sale is one transaction: a date, optional tags, and one or more line items
(`{ itemId, quantity }`). Each line's unit price is snapshotted from the item at
sale time, so editing an item's price later doesn't change past sales.

An expense is the same shape, but each line is `{ itemId?, description?, quantity, unitCostCents }`
and must give exactly one of `itemId` or `description`: an `itemId` line restocks
that item (adds `quantity` to its stock, using the unit cost you paid, not the
item's sale price); a `description` line (e.g. `"Rent"`) is a free-text cost with
no stock effect. Editing or deleting an expense undoes its restock first, so if
the restocked stock has since been sold below that amount, the edit/delete is
rejected with a 400 rather than letting stock go negative.

Analytics groups sales and expenses by each record's first tag (top 3 by value;
the rest fold into "Other"). `range` is one of `week` (last 7 days), `month`
(month-to-date, by day), `ytd` (year-to-date, by month), or `12months` (default,
trailing 12 months) — it's the one page-wide window: Revenue Overview, Expenses
Overview, the Sales Overview donut, and Net Profit/Revenue/Expenses are all
scoped to it, so changing it moves the whole page together.

### Configuration

Set these as environment variables (a `.env` file isn't read automatically; export them, or use your IDE's run configuration). Without them, `backend/src/main/resources/application.yml` defaults to the local Docker Postgres from `docker compose up -d`.

| Variable                      | Required | Description                                                                 |
| ------------------------------ | -------- | --------------------------------------------------------------------------- |
| `SPRING_DATASOURCE_URL`        | No       | `jdbc:postgresql://host/dbname?sslmode=require`. Default: `jdbc:postgresql://localhost:5433/jack` |
| `SPRING_DATASOURCE_USERNAME`   | No       | Default: `jack`                                                              |
| `SPRING_DATASOURCE_PASSWORD`   | No       | Default: `jack`                                                              |
| `SPRING_PROFILES_ACTIVE`       | No       | Set to `demo` to seed the demo account on startup                           |
| `PORT`                         | No       | Defaults to 4000 (Render sets it automatically)                             |

### Deploying to Render

1. Create a Neon (or other hosted Postgres) database and copy its connection string.
2. In Render: since this repo isn't owned by the account deploying it, use **New > Web Service > Public Git Repository** (rather than **New > Blueprint**) and paste this repo's URL.
3. Language: **Docker**. Dockerfile Path: `backend/Dockerfile`. Docker Build Context Directory: leave as `.` (the repo root — the Dockerfile needs both `backend/` and `demo/client/`).
4. Health Check Path: `/api/health` (exactly — a trailing/duplicated path here will make every deploy time out waiting on the health check).
5. Environment variables: `SPRING_DATASOURCE_URL` (JDBC form, e.g. `jdbc:postgresql://<host>/<db>?sslmode=require`), `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, and `SPRING_PROFILES_ACTIVE=demo`.
6. The free instance type's 0.1 CPU is too slow to boot the JVM within Render's health-check window — every free-tier deploy we tried either failed outright or took 15+ minutes. Use the $7/month instance (0.5 CPU), which boots in under a minute.
7. Each push to the selected branch does **not** auto-deploy — "Public Git Repository" services don't get webhooks from a repo they don't own. Redeploy manually from the Render dashboard (**Manual Deploy > Deploy latest commit**) after pushing.

 ## Deployment and Github Workflow

 * Making Pull Requests for major changes with at least one member from the subteam looking over it before merging.
     * Ex: if the PR is a backend change, another backend member will look it over.
     * This allows a fresh set of eyes to look over the functionalities and catch any potential bugs/edge cases that weren't covered in testing.
     * Additionally, this prevents unreviewed commits to production branch.
 * Branching Strategy and Naming Convention: all new work is developed on separate feature branches that branch off from *main*, named for the user story or feature they add.
     * Ex: `us1-sales`, `us2-inventory`, `allie/java-expenses`
     * This keeps each branch's purpose clear from its name, and keeps related commits for one feature together until it's reviewed and merged.
 * Deployment: the backend is deployed as a Render web service (see [Deploying to Render](#deploying-to-render)); since pushes don't auto-deploy, redeploy manually from the Render dashboard after merging.
  

 ## Coding Standards and Guidelines
    
 * We use automated tools like Prettier and ESLint (TypeScript) to enforce consistent code styling and catch syntax errors; the Java backend follows standard Maven/Spring project conventions.
 * Our development strictly adheres to separation of concerns to ensure a clean & modular architecture between different system components
 * All developers must write code that have clear, descriptive function names and implement comprehensive error handing.
​
 ## Licenses
​
 MIT License

Copyright (c) 2026 Jack-Of-All-Trades Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

<br>

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

<br>

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Deployed URL / Access Instructions

**https://jack-of-all-trades-java.onrender.com**

Log in with:

```
email:    demo@jackofalltrades.test
password: ChangeMe123!
```

...or click "Register" to create your own business account — every dashboard only ever shows your own business's data.

### Screenshots

| Home dashboard | Inventory |
| --- | --- |
| ![Home dashboard](docs/screenshots/home.jpg) | ![Inventory page](docs/screenshots/inventory.jpg) |
