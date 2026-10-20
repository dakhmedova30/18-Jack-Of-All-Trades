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

 * Business Owners: Register a business account.
     * Bookkeeping Dashboard: Click "Add" to record a sale (one transaction). Set a date and tags, then add one or more line items (an inventory item + quantity each); the line and sale totals are computed from the item's price. Recording, editing or deleting a sale keeps inventory stock in sync automatically.
     * Inventory Dashboard: Click the "Add Item" button to add an item, set prices, and set stock count.
     * Expenses Dashboard: Click "Add" to record an expense. Set a date and tags, then add one or more lines; each line either restocks an inventory item (pick it, and its stock goes up by the quantity) or is a free-text cost like "Rent" with no stock effect. Recording, editing or deleting an expense keeps inventory stock in sync automatically.
     * Analytics Dashboard: View various business performance metrics. Currently a static visual demo; the numbers aren't wired to real data yet.
     * Business Profile Dashboard: Set up a public profile for customers to see.
 * Customers: Register a customer account.
     * Can browse and look up available businesses and make purchases. 
 
## Development Requirements

### Prerequisites

 * macOS, Linux or Windows
 * [Node.js](https://nodejs.org/) 22.13 or newer (24 LTS works too; `nvm use` reads `.nvmrc`) and npm 10+
 * Git
 * A PostgreSQL database, either hosted (AWS RDS, Neon, Supabase, ...) or local ([Postgres.app](https://postgresapp.com/) on macOS)

### Tech stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, React Router                |
| Backend  | Node.js, Express 5, TypeScript, Zod (validation)        |
| Database | PostgreSQL via `pg`                                     |
| Hosting  | Render (one web service), any hosted Postgres           |
| Tooling  | ESLint, Prettier, Vitest + Supertest, GitHub Actions CI |

### Setup

```bash
git clone <repo-url> jack-of-all-trades
cd jack-of-all-trades
npm install                            # installs client + server (npm workspaces)
cp server/.env.example server/.env     # then set DATABASE_URL in server/.env
npm run seed                           # optional: loads 24 sample inventory items
npm run dev                            # API on :4000, web app on http://localhost:5173
```

Tables are created automatically the first time the server connects. `server/.env` is git-ignored: never commit database passwords.

Open http://localhost:5173. In development the Vite dev server forwards `/api/*` to the API. In production, Express serves the built React app and the API from one URL.

### Scripts (run from the repo root)

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Runs API and web app together with hot reload                        |
| `npm run seed`      | Seeds an empty database (`npm run seed -- --force` wipes and reseeds) |
| `npm test`          | Runs the API tests against `TEST_DATABASE_URL` (skipped if unset)    |
| `npm run typecheck` | Type-checks client and server                                        |
| `npm run lint`      | Runs ESLint                                                          |
| `npm run format`    | Formats everything with Prettier                                     |
| `npm run build`     | Builds `server/dist` and `client/dist`                               |
| `npm start`         | Runs the production server (after `npm run build`)                  |

### Project structure

```
client/                      React app (UI + frontend teams)
  src/api/                   fetch wrappers, one file per resource
  src/components/            shared UI: layout, modal, pagination, icons
  src/hooks/                 data-loading hooks (useItems)
  src/pages/                 one folder per dashboard
  src/styles.css             design tokens + styles from the Figma wireframe
server/                      Express API (backend team)
  src/modules/<feature>/     routes -> service -> repository, plus zod schema + tests
  src/db/                    Postgres connection, schema, sample data, seed script
  src/middleware/            shared error handling
render.yaml                  Render deployment config
```

Each backend feature follows the same layers: **routes** handle HTTP only, **services** hold business rules, **repositories** hold all SQL. New features (analytics, profiles, customers) should copy `server/src/modules/items`.

### API

All error responses share one shape: `{ "error": { "message": string, "details"?: [{ "field", "message" }] } }`. Money is always sent as integer cents.

| Method | Endpoint                 | Description                                |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/health`            | Health check (also checks the database)    |
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

### Configuration

Set these in `server/.env` locally, or as environment variables on the host. See `server/.env.example`.

| Variable            | Required | Description                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`      | Yes      | `postgres://user:password@host:5432/dbname`                                 |
| `DATABASE_SSL`      | No       | `disable`, `require` or `verify`. Default: off for localhost, `require` otherwise |
| `SEED_IF_EMPTY`     | No       | `true` loads sample items on startup when the database is empty             |
| `PORT`              | No       | Defaults to 4000 (Render sets it automatically)                             |
| `TEST_DATABASE_URL` | No       | Throwaway database for `npm test`; **every table in it is emptied**         |

### Deploying a demo to Render

1. Create a Postgres database (AWS RDS, Neon, Supabase, ...) and copy its connection string. On AWS RDS, set the instance to *Publicly accessible* and allow inbound port 5432 in its security group, or Render cannot reach it. That is acceptable for a demo, not for production.
2. Push this repo to GitHub.
3. In Render, choose **New > Blueprint**, select the repo, and paste the connection string when it asks for `DATABASE_URL`. `render.yaml` sets up everything else.
4. Each push to `main` redeploys automatically. Free instances sleep when idle, so the first visit after a while takes a few seconds.

 ## Deployment and Github Workflow

 * We use Jira to list and assign user stories/features to work on.
     * This allows us to track what features we are working on and easily add new tickets when necessary.
 * Making Pull Requests for major changes with at least one member from the subteam looking over it before merging.
     * Ex: if the PR is a backend change, another backend member will look it over.
     * This allows a fresh set of eyes to look over the functionalities and catch any potential bugs/edge cases that weren't covered in testing.
     * Additionally, this prevents unreviewed commits to production branch.
 * Branching Strategy and Naming Convention: all new work is developed on separate feature branches that branch of from *main*, with a naming convention like *feature/JIRA-number-descripition*.
     * Ex: JIRA-3-accounting-api
     * This allows us to be able to trace codebase changes and match them with the original Jira requirements.
  
  * Deployment tools: in discussion.
  

 ## Coding Standards and Guidelines
    
 * We use automated tools like Prettier and linters to enforce consistent code styling and catch syntax errors.
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

Provide a link to the deployed application or clear instructions for how to access it. For mobile apps, include TestFlight/APK links or emulator instructions. For APIs, include Postman collections or curl examples.

* Not yet available.
