# Jack-Of-All-Trades - Individual Contributions (D3)

> For each team member: name, role, and specific contributions. Be precise about what you did, not how much you wrote.

> [Specific contributions: features built, PRs reviewed, infrastructure set up, etc.]

**Allie Huynh**, Front-end
- Error handling for the following: login (email in use, valid email check, password length), registration (wrong email or password), and error handling for errors that apply to both (can't reach the server), errors announced for accessibility users.

**Minh Tran**, Front-end and UI design & implementation
- Features built: Sidebar reorganization, User menu (user icon at bottom of sidebar), Settings page (all subpages under Settings and their functionalities except Public Profile), Help & Support, Privacy, Terms, Date Filter in Analytics.
- Features supported:  added an outline for current being read for Text-to-speech, Show/Hide item UX for Public Profile.
- PRs reviewed: 16, 17, 19, 21, 22, 23, 24, 25.
- Product evolution: worked on part 3 and 4.

**Hans Santiago**, Back-end, CI/CD, & integration
Precise description:
* CI/CD: set up GitHub Actions to run the backend tests on every PR, with time limits set from measured runs, and to deploy to Render through a secret deploy hook only after all checks pass (#10); later added the frontend tests to CI (#18).
* Testing: fixed the 5 backend test failures and the notification crash for new accounts that CI caught in #8, and documented how to run both test suites (#11).
* Environment: added `.env.example` templates for the backend and frontend, kept real `.env` files out of git, fixed the stale Render deploy config, and ran a full-history secret scan (#13).
* Demo data: built the demo-account seeder: sample products, about six weeks of sales, restocks and costs, always including the current month, added only to an empty account so the live demo is never touched (#23, 5 tests).
* Home: added a period filter (last 7 days, this month, this year, last 12 months) that is remembered per browser and explains empty periods instead of showing bare zeros (#24, 5 tests).
* Currency (#19): merged main in twice and resolved the conflicts; fixed the exchange-rate config that stopped the backend from starting; made the edit forms show each sale and expense in the currency it was recorded in (3 tests).
* Integration fixes on teammates' PRs: moved the "not selling" backend into #22 so the Inventory page no longer went blank (4 tests); updated tests broken by other PRs on #18 and #20, and linked login errors to their fields (#20); fixed the read-aloud bar covering page content (#17) and the sidebar overlapping dialogs (#9); and before submission, removed unused theme CSS (#28) and fixed the README's macOS Java setup step (#29), found by following the README from a fresh clone.
* Reviews: reviewed #8, #9, #12, #14, #16, #17, #18, #19, #20 and #22 (approved #12, #14 and #16).
* Accessibility and NFR evidence: measured Lighthouse accessibility on the live site (96–100 on every main page) and documented the accessibility, security and production measures in the README (#26).
* Documentation: rewrote the README for D3 (try-it section, current workflows, response to D2 feedback, new screenshots) (#26), wrote sections 1–2 and the D4 plans of the product evolution report (#27), and added the team meeting minutes (#25).

**Kimberly Prijadi**, Frontend Developer (UI/UX and accessibility); currency conversion implementation

- Currency conversion (#19, Copilot-assisted):
  - Supplemented the currency conversion workflow with an optional "convert existing inventory prices" checkbox, a preview/confirmation dialog (items affected, sample before/after prices, rate and "as of" date), and a notice when bundled or stale rates are in use.
  - Backend: `ExchangeRateService` (fetches USD-base rates from open.er-api.com, caches until the API's next-update time, falls back to last good rates and then to a bundled snapshot, `exchange-rates-fallback.json`) and `CurrencyChangeService` (converts inventory prices in one transaction with `BigDecimal`; relabel mode only updates rows in the previous currency). Supported currencies and retry settings are configured in `application.yml`.
  - Sales and expenses keep their own stored currency; totals are converted at read time.
  - Wrote 23 tests covering API/integration, service tests, and API failures.
  - Fixed four problems found in review: edits restamping an old record's currency (a €100 expense became CA$100 after a description edit), repeated failed rate fetches during an outage, relabel touching rows in other currencies, and the config placement/typo that stopped the app starting. Hans helped resolve merge conflicts and the edit forms showing each record's own currency.
- Accessibility (#14, Copilot-assisted):
  - Collapsible sidebar with keyboard-accessible navigation.
  - Focus entry, focus trapping, and focus restoration for dialogs and popovers (`Modal.tsx`, `AccountMenu.tsx`, `NotificationBell.tsx`), with Esc to close; fixed dialogs opening on the ✕ button after review.
  - Fieldset/legend grouping, required semantics, and error messages linked to inputs in the item, sales and expense forms.
  - Arrow-key navigation for the custom radio groups in `AppearanceTab.tsx`; descriptive page titles and a `main` landmark on login and registration.
  - Confirmation before closing an edited item, sale, or expense form.
- UI polish (#9):
  - Required-field indicators, show-password on login and registration, maximum limits on cost and price inputs. (copilot assisted)
  - Reworked the Sales summary and made summary panels consistent and stacking on small screens; adjusted settings tab heights and small-screen widths.
  - Moved cards to the top of the Inventory and Sales pages, as the TA suggested.
- Cosmetic and layout work (#22):
  - Switched the body font to Atkinson Hyperlegible, added the "Not Selling" inventory panel (items not sold this month), and made stat cards stack at 720 to 900px so text stays inside the card. Hans took over this PR to fix the Inventory page going blank against main's backend while I worked on #19.
- **PRs reviewed:** #8, #10, #11, #15, #26, #27, #28, #29.

**Jinuo Tao**, Back-end Developer; public business profile (full stack)
- Public business profile (#12): built D1's US3/US4, the MVP stories that hadn't been built by D2. Owners turn on a shareable page at `/p/<link name>` in Settings > Profile and choose which items appear on it; customers view it without an account.
  - Backend: migration for item visibility and a unique link name per business; public endpoints for the profile and logo; the response only includes chosen fields, so email, phone, address, stock counts, notes and tags are never shown; an unknown and a turned-off profile return the same 404; bad link names return 400 and taken ones 409.
  - Frontend: the public profile page, a "Show on my public profile" checkbox in the item form, a "Public" marker in the Inventory table, and the Public profile section in Settings > Profile.
  - 12 backend tests. Lighthouse accessibility 100 on the public page. Documented in the API contract and README.
- Bulk show/hide on the public profile (#21, suggested by a teammate): "Show on profile" and "Hide from profile" buttons for selected inventory items, with a new bulk endpoint. After Minh's review, each button only enables when it would change something, and a mixed selection lists the skipped items before changing the rest. 3 backend tests, 4 frontend tests.
- **PRs reviewed:** #13 (found three problems in the `.env.example` templates; approved after the fixes), #15 (found the date filter jumping while a year is typed and a 500 on extreme dates; approved after the fixes), #17 (found the read-aloud bar covering page content).

**Aidan Wang**, Full-stack Developer; sales and analytics filters
- Sales filters (#15): owners can narrow the Sales table to one channel and/or a date range instead of paging through every sale.
  - Backend: `GET /api/sales` takes optional `channelId`, `from` and `to`, combined with the existing search, sorting and paging. Dates are inclusive whole UTC days, matching how the app stores and shows them. Filters reuse the existing parameterized query and stay limited to the logged-in business, so another business's channel id matches nothing. A backwards range or an invalid date returns a readable 400 instead of a stack trace.
  - Frontend: a Channel dropdown, From/To date pickers and a "Clear filters" link next to the search box. Changing a filter returns to page 1. When nothing matches, the table says so and offers to clear the filters (it used to show the "Add a new sale" prompt).
  - After Jinuo's review, fixed the date range jumping back to year 2 while a year was typed in Chrome. The other end now stays put, a backwards range shows "From must be on or before To" and keeps the last good results, and filtering waits until typing settles. Years outside 1–9999 now return a 400 instead of a 500.
  - 6 backend tests plus year-bound checks. Documented in the API contract.
- Analytics channel filter (#16): added a sales channel dropdown to the Analytics filter sidebar that narrows the revenue figures. Expenses aren't tied to a channel, so they stay whole, and Net Profit is hidden when a single channel is selected. Added a Revenue by Channel card showing each channel's share of revenue for the chosen period. `GET /api/analytics/summary` takes an optional `channelId` and returns `revenueByChannel`. After Minh's review, moved the card under the filter to fill the empty left column. 4 backend tests; documented in the API contract.
- **PRs reviewed:** #18 (approved after running all 22 tests, lint, typecheck and format locally; flagged the Analytics test that #16 would break), #19 (found four problems that were fixed before merge: editing an old record changed its currency, so a €100 expense became CA$100; every conversion retried the rate fetch while the rates API was down; relabel rewrote records in other currencies; and the exchange settings were in a new `application.properties` instead of `application.yml`).

**Diana Akhmedova**, Full-stack Developer; TTS, frontend testing, CSV import/export, inventory/currency, sales channels
- Text-to-speech / read-aloud (`tts` branch, PR #17): built the `SpeechReader` read-aloud bar and wrote the PR description for it.
- Frontend Testing (PR #18): Created a PR for tests for registration, login, protected-page access, logout, inventory creation, and sale and expense submission. Included tests for analytics range changes and for date and money utilities, using mocked API responses so no live database is needed.
- CSV import/export (`feature/csv-import-export`, PR #30):
  - Added Import CSV and Export CSV to Inventory, Sales and Expenses, and an export-only control on Analytics.
  - Export downloads every record, not just the current page. Analytics export follows the selected date range and channel.
  - Import updates records whose `id` matches and creates records with no `id`. Invalid rows are reported by row number while the rest still import.
  - Wrote the CSV parser and encoder (quoted fields, line breaks, UTF-8 BOM, duplicate columns), unit tests for them, and the README documentation.
- Additional item fields and multi-currency (`additional-item-fields`, still in progress):
  - Inventory: Added item size (inches or centimetres), an item type, an optional starting "Amount sold" count, and the ability to deactivate an item without losing past sales and restocks. Also reworked the Inventory table.
  - Currency: Added a currency picker for items, sales and expenses (CAD default). Rates are fetched daily from open.er-api.com, cached in Postgres, and fall back to the cache. Sales and expense totals are stored in CAD with the original currency kept.
  - Backend: Wrote the database migration, the item, sale and expense service changes, and updated the public-profile fields.
  - Frontend: Updated the item, sale and expense forms for the new fields and currencies.
- Sales and Business Tabs (still in progress): Added In-Person Market (with a faster sale-entry form), Online Shop, Commissions and Miscellaneous tabs, plus reusable sale adjustments (Discounts and Charges).
- Navigation and Layout (still in progress): Grouped the sales-type tabs under a collapsible Sales menu placed between Inventory and Expenses, moved Discounts and Charges below Expenses, and restyled the Expenses tab to follow the new flowchart design.
- Records and Filters (still in progress): Added IDs, delete and bulk delete, and consistent formatting across tabs. Made every field searchable and filterable, with multiple filters combinable (for example type and amount sold). Fixed the revenue, expenses and profit summary formatting on Commissions and Miscellaneous.
- **PRs reviewed:** #17, #18, #30, #31
