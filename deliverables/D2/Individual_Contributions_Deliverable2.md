- Name of the student
- One-line description of their role in this deliverable
- Precise description of contributions made

-----

1. Minh Tran
2. Designing UI/UX and implementing various components on all pages.
3. Precise description:
- Added/modified items on Home, Inventory, Sales, Expenses, Analytics pages. 
- Home: implemented horizontal information strip at the top (Revenue, Expenses, Net profit, Low stock), implemented Recent Sales table at the bottom
- Inventory: implemented sorting entries (by ID, Name, Qty, Unit price), changed the maximum # of shown entries to 15, added 'Stock value' and 'Low stock' cards at the bottom
- Sales: implemented sorting entries (by ID, Date, Total, Channel), changed the maximum # of shown entries to 15, added 'This month at a glance' and 'Best sellers' cards at the bottom
- Expenses: implemented sorting entries (by ID, Date, Total, Tags), changed the maximum # of shown entries to 15, added 'Where the money goes' and 'Top restock spending' cards at the bottom
- Analytics: reworked analytics page to have 4 graphs: Revenue Overview, Expenses Overview, Revenue & Expense Breakdown, Inventory Overview, added month filter for Revenue & Expense Breakdown graph,
moved data strip (previously vertical strip to the right of Revenue Overview) to horizontal strip above graphs

-----

Kimberly Prijadi
> Helped with UI/UX and implemented stylistic decisions onto the app.
- Designed the layout for the analytics dashboard (that wasn’t drawn out yet in D1)
- Decided and implemented the color and font combinations to give the dashboard a more unique look, while also keeping in mind color contrast.
- Further UI changes:
  - Updated the appearances of specific card elements on Sales, Inventory, and Expenses tabs to make the information more readable.
  - Collapsible sidebar (with the sidebar itself separated into its own component)
  - Have it so the main content doesn’t scroll with the sidebar

-----

Hans Santiago - Built the initial demo, migrated online, built the login system, and led the switch to the Java backend.

Precise description:
- Demo: built the initial demo based on the team's frontend/UI work.
- Database: migrated from local Postgres to a hosted Neon Postgres instance.
- Webapp: deployed the application to Render.
- Login: implemented user authentication registration, login, logout, and session-cookie-based auth using Node's built-in password hashing.
- Security: scoped all data (inventory, sales, expenses, analytics) so each business only sees its own records; every protected route requires a valid session, returning 401 otherwise.
- Backend migration: hard-switched the frontend from the Node backend to the team's new Java/Spring Boot backend, auditing every page (Inventory, Sales, Expenses, Analytics, Accounts) against the API contract and verifying every workflow end-to-end.
- Deployment: deployed the Java backend to Render (Docker build, environment configuration, health checks)
- Accessibility: fixed missing form labels, keyboard-inaccessible table rows, missing focus indicators, missing page headings, and a missing 404 page.
- Documentation: rewrote the README end-to-end for the Java backend (setup, API reference, configuration, deployment instructions).
- Cleanup: removed the now-unused Node/Express backend and its dependencies from the repo. 

-----

Allie Huynh - Added expenses page, and modified sales and expenses layout 

Precise description: 
- Expenses and sales layout:
    - Reflected these changes through code
    - Helped with stylistic choices of sales and expenses' "add" and "modify" pop-up window to improve readability and clarity
- Implemented the expenses page on the backend side
- Updated API contract to reflect these changes

-----

Aidan Wang - Implemented the US2 Inventory backend.

Precise description:

Inventory: added creating, editing, deleting and bulk deleting items, checked against the API contract. Deleting an item keeps its name in past sales.
Insights: added total stock value, this month's top 3 best sellers, and a list of items with 5 or fewer left.
Security: each business only sees its own items, and editing stock can't overwrite a sale saved at the same moment.
Testing: wrote integration tests for all new endpoints.

-----

Jinuo Tao: Designed and built the foundation of the Java backend, implemented the US1 Sales and US3 Analytics backends, and prepared the backend's integration with the frontend.

Precise description:
- Backend architecture: designed the Java Spring Boot backend and wrote the design doc and API contract that the frontend and backend build against.
- Backend skeleton: built the base every backend feature runs on: database setup, register/login/logout, each business's data kept private, and error handling that matches the contract.
- US1 Sales: implemented recording, editing, deleting, searching and sorting sales, sales channels, and a monthly summary, with stock kept correct when sales are recorded, edited or deleted.
- US3 Analytics: moved the analytics dashboard (revenue, expenses and profit by tag over a chosen time range, and inventory by tag) from the TypeScript demo to the Java backend.
- Integration: prepared and opened a series of stacked PRs to bring all backend features into the frontend branch, and checked that every API call the frontend makes works with the Java backend.
- Testing and fixes: wrote integration tests for my features, reviewed and tested the Expenses backend for a teammate who couldn't run the tests locally, and fixed a bug where prices and quantities silently dropped decimals.
- Team support: wrote implementation plans and a backend README guide that teammates used to build Inventory and Expenses.

-----

Diana Akhmedova
> Frontend Testing, Database Architecture, and UI/UX Design

Precise description:
- Frontend Testing: Implemented frontend tests covering the main user flows, including user registration and login, protected-page access, logout, inventory item creation, and sales and expense submissions.
    - Added tests for analytics time-range changes and date and money utility functions, including invalid inputs.
    - UI tests use mocked API responses, allowing them to run independently without a database connection.
- Database Architecture: Designed the database architecture flow, including the structure and relationships between tables to support the application's core features, such as inventory management, sales tracking, expense tracking, and analytics.
- Figma Prototype: Expanded the existing Figma prototype with more detailed designs, refining page layouts, interface components, and feature representations to better guide frontend development and maintain UI/UX consistency.
    - Added precise components that mirror the elements business owners want to keep track of for better organization and analytics reviews.
