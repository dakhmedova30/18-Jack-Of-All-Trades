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

Hans Santiago - Built the initial demo, migrated online, and built the login system.

Precise description: 
- Demo: built the initial demo based on the team’s frontend/UI work.
- Database: migrated from local Postgres to a hosted Neon Postgres instance
- Webapp: deployed the application to Render
- Login: implemented user authentication registration, login, logout, and session-cookie-based auth using Node’s built-in password hashing.
- Security: scoped all data (inventory, sales, expenses, analytics) so each business only sees its own records; every protected route requires a valid session, returning 401 otherwise

-----

Allie Huynh - Added expenses page, and modified sales and expenses layout 

Precise description: 
- Expenses and sales layout:
    - Reflected these changes through code
    - Helped with stylistic choices of sales and expenses' "add" and "modify" pop-up window to improve readability and clarity
- Implemented the expenses page on the backend side
- Updated API contract to reflect these changes
