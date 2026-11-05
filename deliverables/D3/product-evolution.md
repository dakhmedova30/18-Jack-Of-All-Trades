# YOUR PRODUCT/TEAM NAME

> Aim for 1000-2000 words. Be concise and analytical. We care about reasoning, impact, and integration quality, not length.

## 1. What Needed to Improve
<!-- Identify the most important gap or limitation after D2 and how you identified it. -->

### The most important gap

Jack-Of-All-Trades promises small businesses [management *and* intelligence](../../README.md#description-about-the-project), but at [D2](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/tree/D2) it delivered mostly the first half: owners could record sales, expenses and stock but learn little from them. Every sale stored its date and channel, yet Analytics offered only four fixed periods ending today and no channel breakdown, and the Sales list had only free-text search, with no date filter. "How did last holiday season go?" and "Which channel earns the most?" had no answer. We ranked this first because it touches every owner on every visit and is the product's reason to exist. Three smaller gaps surrounded it: owners couldn't edit their account or password, rename a channel or set their own low-stock cutoff; pages built by different teammates looked and behaved differently, and dialogs lost keyboard focus; and quality relied on people rather than checks, since CI ran no tests and every deploy was manual.

### How we identified it

- **Feedback and reflection:** demo-day feedback was about how information is laid out, and our [D2 retrospective](../D2/iteration-02-review.md) planned analytics by sales channel, UI consistency and more integration testing.
- **Using the product:** answering real questions with the demo account's 15 months of data showed that a quarter of its sales never appeared in Analytics.
- **Testing:** once CI ran the backend tests, the first PR it checked ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8)) failed.

## 2. What You Did
<!-- Describe what was implemented, key architectural or design changes, and integration challenges. -->

Our work fell into four areas, most important first:

- **Finding answers in the data** ([#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15), [#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16)): channel and date filters on Sales; on Analytics, a side panel with dates, a slider over the whole history and a channel filter, plus a Revenue by Channel card.
- **Running the business from the app** ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8), [#12](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/12), [#21](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/21)): Settings for account, security, preferences and notifications, and a public business profile whose products can be shown or hidden in bulk.
- **Consistency and accessibility** ([#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9), [#14](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/14), [#17](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/17), [#20](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/20)): shared cards, fonts and colours, a collapsible sidebar, focus-managed dialogs, page titles, a read-aloud reader, and login and registration errors that say what to fix.
- **Reliable delivery** ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10), [#11](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/11), [#13](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/13), [#18](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/18)): backend and frontend tests and time limits in [CI](../../.github/workflows/ci.yml), automatic deploys once everything passes, and [documented configuration](../../backend/.env.example).

### Key design changes

- **Periods instead of fixed ranges:** owners think in seasons, not "the last 12 months", so `GET /api/sales` and `GET /api/analytics/summary` now take `from` and `to` (whole UTC days, both included). Analytics picks daily, weekly or monthly buckets from the period's length, so one endpoint serves a week or the whole history and charts stay readable; `/api/analytics/date-range` gives the slider its ends.
- **Honest numbers where data is missing:** expenses have no channel, so one channel's revenue minus every expense would be a misleading profit. The channel filter narrows only revenue, and Net Profit shows "—" with the reason.
- **Public data by allowlist:** the public profile is our first endpoint that needs no login, so it has its own response type instead of reusing the owner's. A field added to a business or item later stays private unless someone adds it to the profile on purpose.

### Integration challenges

- **Deploying from a repo the service doesn't own:** our Render service gets no push events from a repository owned by another teammate's account. CI now calls its deploy hook (kept in a GitHub secret) after the checks pass, so nothing untested reaches the live site.
- **Changing an endpoint Home depends on:** Home's month-to-date cards use the summary endpoint Analytics was rebuilding, so the API keeps the fixed ranges alongside periods and the shared hook accepts either.
- **Settings every page depends on:** once preferences and notifications wrapped every logged-in page, components couldn't be tested on their own, so the frontend tests ([#18](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/18)) gained shared test providers and complete test records.

Merge conflicts, our largest integration cost, are covered in Section 4.

## 3. Before vs. After
<!--  Show concrete improvements: workflow clarity, speed, error reduction, reliability, etc. -->

"Before" is our `D2` tag; "after" is `main` plus PRs #15–#17. Figures come from our demo dataset (1,177 sales and 171 expenses, Aug 1, 2025 – Oct 29, 2026).

### Finding answers in the data ([#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15), [#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16))

| Question | Before (D2) | After (D3) |
| --- | --- | --- |
| How did last holiday season go? | Not answerable: Nov–Dec 2025 fell outside "12 months", the longest fixed period. | Filter to Nov 1 – Dec 31, 2025: $8,719 revenue, $4,600 expenses. |
| Which channel earns the most? | Not shown, though every sale records its channel. | Online 51%, In person 39%, Commission 6%, Misc 4%. |
| Which Online sales made up that season? | Scan 14 pages of sales by eye. | Filter Sales: 101 sales on 7 pages. |
| What does the whole history look like? | 297 of 1,177 sales (25%) never appeared in Analytics. | Drag the slider to both ends. |

One side panel now sets the period and channel for every card, replacing two time controls that could disagree. Totals now match the charts: D2's "12 months" had no end date, so a future-dated sale counted in the totals but on no chart point. Invalid dates are flagged at the field, and the API returns readable 400 errors. A summary takes 8–17 ms, so the page reloads as soon as the slider stops.

### Running the business from the app ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8), [#12](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/12))

| Task | Before (D2) | After (D3) |
| --- | --- | --- |
| Rename a channel or expense tag | Impossible | Settings > Preferences; past expenses follow the rename |
| Change password or email | Impossible | Requires the current password and logs out other devices |
| Notice low stock | Check Inventory by hand | A notification bell with five configurable alerts |
| Show products to customers | No public page | `/p/<link-name>`, which never exposes contact details or stock counts |

Backend tests in these areas grew from 21 to 68.

### Consistency and accessibility ([#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9), [#14](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/14), [#17](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/17))

Lighthouse scored 100 for accessibility at D2 and still does on every D3 page, but it only checks what is on the page, not how it behaves. We checked behaviour by hand, with the keyboard and VoiceOver:

| Check | D2 | D3 |
| --- | --- | --- |
| Open "Add sale" | Focus stays behind the dialog | Focus starts in the first field |
| Tab past the last field | Focus leaves the dialog | Focus stays inside |
| Close with Esc | Focus is lost | Focus returns to the button that opened it |
| Click outside a half-filled form | The input is lost | The app asks first |
| Submit with a mistake | The error isn't read | The field and its error are read |
| Switch pages | Every title is "Jack-Of-All-Trades" | Each page announces its name |

Summary cards now share one component, prices are capped with a clear message, and any page can be read aloud.

### Reliability of delivery ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10), [#13](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/13))

At D2, CI ran no tests and deploys were manual. Now every PR runs the backend suite (139 tests at D2, 200 now), `main` deploys only when everything passes, and configuration is documented in `.env.example` templates.

## 4. Reflection

<!-- What worked well, what was harder than expected, and how this affects your path to D4. -->

### What worked well

- **Reviewing every PR:** Reviews caught bugs before users did: notifications crashing for every new account (#8), a stylesheet rewrite that broke the account menu (#9), and a date field resetting to the year 2 (#15). They also sparked new work: a comment that the saved currency had no effect led to #19.
- **Letting CI run the tests:** The backend tests for #8 had never been run until CI (#10) ran them and caught 5 failures. A failing test now blocks the deploy.
- **Keeping the API contract current:** At D2, the contract drifted from the code. This time every PR that changed the API also updated `docs/api-contracts.md`.
- **Building on each other's branches:** #16 combined one teammate's date filter with another's channel filter.

### What was harder than expected

- **One shared stylesheet:** When #9 reorganized our 2,400-line stylesheet, every open branch conflicted, and most of our merge time went to CSS.
- **Conflicts git can't see:** Seven PRs were opened within five hours. #18 tests the "Show by" dropdown that #16 removes, so it would merge cleanly and then fail.
- **Dates:** Chrome reports half-typed years like `0002`, and UTC days put an evening sale in Toronto on the next day.
- **Measuring accessibility:** Lighthouse was already at 100, so we had to verify the improvements by hand.

### How this affects our path to D4

- **Merge smaller and sooner:** The analytics branch fell 32 commits behind `main`. We'll merge `main` into open branches daily, keep PRs open for 2–3 days at most, and merge #15 and #16 before #19 and #18.
- **Finish the MVP from feedback:** Use the saved currency and time zone, tie expenses to channels, and build account switching.
- **Raise the quality bar:** Add the frontend tests (#18) to CI and split the stylesheet by component.
- **Showcase:** The public profile and demo data give outside users something to try without an account.
