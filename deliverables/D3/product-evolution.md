# Jack-Of-All-Trades: Product Evolution (D3)

## 1. What Needed to Improve
<!-- Identify the most important gap or limitation after D2 and how you identified it. -->

### The most important gap

Jack-Of-All-Trades promises small businesses [management *and* intelligence](../../README.md#description-about-the-project), but at [D2](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/tree/D2) it delivered mostly the first half: owners could record sales, expenses and stock but learn little from them. Every sale stored its date and channel, yet Analytics offered only four fixed periods ending today and no channel breakdown, nothing showed which products weren't selling, and the Sales list had only free-text search, with no date filter. "How did last holiday season go?" and "Which channel earns the most?" had no answer. We ranked this first because it touches every owner on every visit and is the product's reason to exist. Three smaller gaps surrounded it: owners couldn't edit their account or password, rename a channel or set their own low-stock cutoff; pages built by different teammates looked and behaved differently, and dialogs lost keyboard focus; and quality relied on people rather than checks, since CI ran no tests and every deploy was manual.

### How we identified it

- **Feedback and reflection:** the TA's D2 demo feedback asked for consistent fonts, colours and widgets, low and unsold items made visible, summary cards moved to the top, and tests; our [D2 retrospective](../D2/iteration-02-review.md) planned the same, plus analytics by sales channel.
- **Using the product:** answering real questions with the demo account's 15 months of data showed that a quarter of its sales never appeared in Analytics.
- **Testing:** once CI ran the backend tests, the first PR it checked ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8)) failed.

## 2. What You Did
<!-- Describe what was implemented, key architectural or design changes, and integration challenges. -->

Everything below is live at https://jack-of-all-trades-m86p.onrender.com: log in with the demo account from the [README](../../README.md#deployed-url--access-instructions). Our work fell into four areas, most important first:

- **Finding answers in the data** ([#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15), [#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16), [#24](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/24)): channel and date filters on Sales; on Analytics, a side panel with dates, a slider over the whole history and a channel filter, plus a Revenue by Channel card; and on Home, a choice of week, month or year, with empty periods explained instead of shown as bare zeros.
- **Running the business from the app** ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8), [#12](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/12), [#19](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/19), [#21](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/21), [#22](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/22)): Settings for account, security, preferences and notifications; an account currency, with product prices converted or relabelled; a public business profile whose products can be shown or hidden in bulk; and an Inventory panel listing products with no sales this month.
- **Consistency and accessibility** ([#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9), [#14](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/14), [#17](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/17), [#20](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/20), [#22](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/22)): shared cards, fonts and colours, summary cards at the top of each page, a typeface designed for low-vision readers, a collapsible sidebar, focus-managed dialogs, page titles, a read-aloud reader, and login and registration errors that say what to fix.
- **Reliable delivery** ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10), [#11](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/11), [#13](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/13), [#18](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/18), [#23](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/23)): backend and frontend tests and time limits in [CI](../../.github/workflows/ci.yml), automatic deploys once everything passes, [documented configuration](../../backend/.env.example), and a demo account that fills itself with sample data on a fresh setup.

### Key design changes

- **Periods instead of fixed ranges:** owners think in seasons, not "the last 12 months", so `GET /api/sales` and `GET /api/analytics/summary` now take `from` and `to` (whole UTC days, both included). Analytics picks daily, weekly or monthly buckets from the period's length, so one endpoint serves a week or the whole history and charts stay readable; `/api/analytics/date-range` gives the slider its ends.
- **Honest numbers where data is missing:** expenses have no channel, so one channel's revenue minus every expense would be a misleading profit. The channel filter narrows only revenue, and Net Profit shows "—" with the reason.
- **Public data by allowlist:** the public profile is our first endpoint that needs no login, so it has its own response type instead of reusing the owner's. A field added to a business or item later stays private unless someone adds it to the profile on purpose.
- **Records keep their own currency:** changing the account currency converts product prices (or only relabels them), but each sale and expense keeps the currency it was recorded in and is converted only for display. History is never rewritten, and editing an old record can't silently change its value. Rates come from a live API with a cached copy and a bundled fallback, so an outage never blocks the app.
- **Sample data through the same rules as real data:** the demo seeder records its products, restocks and sales through the normal services, so stock and validation apply, and it only fills an empty account, so the live demo's data is never touched. Its dates count back from today, so "this month" is never empty.

### Integration challenges

- **Deploying from a repo the service doesn't own:** our Render service gets no push events from a repository owned by another teammate's account. CI now calls its deploy hook (kept in a GitHub secret) after the checks pass, so nothing untested reaches the live site.
- **Changing an endpoint Home depends on:** Home's month-to-date cards use the summary endpoint Analytics was rebuilding, so the API keeps the fixed ranges alongside periods and the shared hook accepts either. Keeping them later let Home offer a week, month or year with no backend change ([#24](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/24)).
- **Settings every page depends on:** once preferences and notifications wrapped every logged-in page, components couldn't be tested on their own, so the frontend tests ([#18](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/18)) gained shared test providers and complete test records.
- **A frontend split from its backend:** [#22](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/22) moved the Inventory "Not selling" panel out of the currency PR ([#19](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/19)) without the API field it reads, so against `main` the page went blank while its tests passed on mocked data. The field and its query moved with it.

Merge conflicts, our largest integration cost, are covered in Section 4.

## 3. Before vs. After
<!--  Show concrete improvements: workflow clarity, speed, error reduction, reliability, etc. -->

"Before" is our `D2` tag; "after" is `main` through PR #25. Figures come from a larger local test database (1,177 sales and 171 expenses, Aug 2025 – Oct 2026) filled by a one-off script that isn't in the repo. A fresh setup seeded by #23 has a six-week sample of 20 sales instead, so its numbers will differ.


### Finding answers in the data ([#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15), [#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16), [#22](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/22), [#24](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/24))

| Question | Before (D2) | After (D3) |
| --- | --- | --- |
| How did last holiday season go? | Not answerable: the longest period was the last 12 months. | Filter to Nov 1 – Dec 31, 2025: $8,719 revenue, $4,600 expenses. |
| Which channel earns the most? | Not shown, though every sale stores it. | Online 51%, In person 39%, Commission 6%, Misc 4%. |
| Which Online sales made up that season? | Scan 14 pages of sales. | Filter Sales: 101 sales on 7 pages. |
| What does the whole history look like? | 297 of 1,177 sales (25%) never appeared in Analytics. | Drag the slider to both ends. |
| How is this week going? | Home showed only this month. | Home offers 7 days, this month, this year or 12 months. |
| Which products aren't selling? | Compare Inventory with Sales by hand. | Inventory's "Not selling" panel lists them. |

A summary loads in 8–17 ms, so Analytics updates as soon as the slider stops.

### Running the business from the app ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8), [#12](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/12), [#19](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/19), [#21](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/21))

| Task | Before (D2) | After (D3) |
| --- | --- | --- |
| Rename a channel or expense tag | Impossible | Settings > Preferences; past expenses follow the rename |
| Change password or email | Impossible | Needs the current password; logs out other devices |
| Notice low stock | Check Inventory by hand | A notification bell with five configurable alerts |
| Show products to customers | No public page | `/p/<link-name>`, hiding contact details and stock; products shown or hidden in bulk |
| Sell in another currency | Everything in CAD | CAD, USD, EUR, GBP or AUD; converted prices previewed first; past records keep their currency |

### Consistency and accessibility ([#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9), [#14](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/14), [#17](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/17), [#20](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/20), [#22](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/22))

Lighthouse accessibility scores 96–100 on every main page, but it can't test behaviour, so we checked by hand with the keyboard and VoiceOver:

| Check | D2 | D3 |
| --- | --- | --- |
| Open "Add sale" | Focus stays behind the dialog | Focus starts in the first field |
| Tab past the last field, then Esc | Focus escapes, then is lost | Focus stays inside, then returns to the opening button |
| Click outside a half-filled form | The input is lost | The app asks first |
| Submit with a mistake | The error isn't read | The field and its error are read |
| Log in with a mistyped email | "Validation failed" | "Enter a valid email" under the field, before sending |
| Switch pages | Every title is "Jack-Of-All-Trades" | Each page announces its name |

Summary cards share one component, body text uses Atkinson Hyperlegible (designed for low-vision readers), and any page can be read aloud.

### Reliability of delivery ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10), [#13](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/13), [#18](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/18), [#23](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/23))

At D2, CI ran no tests and deploys were manual. Now every PR runs 237 backend tests (139 at D2) and 56 frontend tests (none at D2), and `main` deploys only when all pass. A fresh setup now opens to sample data instead of $0 tiles and empty charts.

## 4. Reflection

<!-- What worked well, what was harder than expected, and how this affects your path to D4. -->

### What worked well

- **Reviewing every PR:** Reviews caught notifications crashing for new accounts (#8), a stylesheet rewrite that broke the account menu (#9), a date field resetting to the year 2 (#15), and the reader reading hidden text (#17). A comment that the saved currency had no effect led to #19.
- **Letting CI run the tests:** CI (#10) caught 5 failures in the never-run backend tests of #8. Since #18, frontend tests block the deploy too.
- **Keeping the API contract current:** Unlike at D2, every PR that changed the API also updated `docs/api-contracts.md`.

### What was harder than expected

- **One shared stylesheet:** When #9 reorganized our 2,400-line stylesheet, every open branch conflicted, and most of our merge time went to CSS.
- **Dates:** Chrome reports half-typed years like `0002`, and UTC days put an evening sale in Toronto on the next day.

### How this affects our path to D4

- **Merge smaller and sooner:** The analytics branch fell 32 commits behind `main`, and #19 grew to 73 files before #22 was split out of it. We'll merge `main` into open branches daily and keep PRs open for 2–3 days at most.
- **Finish the MVP from feedback:** Use the saved time zone, tie expenses to channels, and build account switching.
- **Raise the quality bar:** Split the stylesheet by component and add end-to-end tests, since mocked frontend tests can't catch the frontend and backend disagreeing.
