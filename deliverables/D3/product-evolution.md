# YOUR PRODUCT/TEAM NAME

> Aim for 1000-2000 words. Be concise and analytical. We care about reasoning, impact, and integration quality, not length.

## 1. What Needed to Improve

Identify the most important gap or limitation after D2 and how you identified it.

## 2. What You Did

Describe what was implemented, key architectural or design changes, and integration challenges.

## 3. Before vs. After
<!--  Show concrete improvements: workflow clarity, speed, error reduction, reliability, etc. -->

"Before" is our `D2` tag; "after" is `main` plus PRs #15–#17. Figures come from our demo dataset (1,177 sales and 171 expenses between Aug 1, 2025 and Oct 29, 2026) and from our test suite.

### Finding answers in the data ([#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15), [#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16))

| Question an owner asks | Before (D2) | After (D3) |
| --- | --- | --- |
| How did last holiday season go? | Not answerable. Analytics offered four fixed periods ending today, and Nov–Dec 2025 fell outside the longest one ("12 months"). | Set the Analytics filter to Nov 1 – Dec 31, 2025, or drag the slider: $8,719 revenue and $4,600 expenses, on a weekly chart. |
| Which channel earns the most? | Not shown anywhere, although every sale records its channel. | Revenue by Channel: Online 51%, In person 39%, Commission 6%, Misc 4%. |
| Which Online sales made up that season? | Sort Sales by date and scan 14 pages (203 sales, 15 per page), picking out Online by eye. | Filter Sales by Online and Nov 1 – Dec 31: 101 sales on 7 pages. |
| What does the whole history look like? | At most 12 months. 297 of 1,177 sales (25%, $13,302) never appeared in Analytics. | Drag both slider handles to the ends: all 15 months. |

- **One filter drives the page:** D2 had two time controls, "Show by" and the Breakdown card's own Month picker, which could show different periods side by side. Now one side panel sets the period and channel for every card except current stock. The Breakdown also uses the same tags and colours as the line charts.
- **No false collapse:** D2's default ended in the current calendar month. On Nov 5 its last point was $0, and two of the four options (Weekly, Month) showed an empty dashboard, because the latest sale was Oct 29. The new default is the 12 months up to the latest record.
- **Totals match the charts:** D2's "12 months" had no end date, so a future-dated sale counted in Total Revenue but appeared on no chart point. A chosen period is now bounded at both ends, and a test checks that sales one second outside either end are left out.
- **Bad input stops at the field:** Backwards or half-typed dates are flagged next to the field and never sent. A hand-crafted request gets a readable 400 (`'from' must be on or before 'to'`), and another business's channel id returns $0, not their data.
- **Fast enough to drag:** A summary takes 8–17 ms on a local backend, even for the full 455-day history, so the page reloads 250 ms after the slider stops.

### Running the business from the app ([#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8), [#12](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/12))

| Task | Before (D2) | After (D3) |
| --- | --- | --- |
| Rename a sales channel or expense tag | Impossible; they could only be added. | Settings > Preferences. Renaming a tag updates past expenses, and a channel that has sales can't be deleted, so no sale is left without one. |
| Change your password or email | Impossible. | Needs the current password, and logs out your other devices. |
| Notice low stock | Check Inventory by hand, with the cutoff fixed at 5. | A notification bell with five alerts (low stock, out of stock, no sales in 3 days, expenses up 20% on last month, a login from a new device). Each trigger can be changed. |
| See where you're logged in | Not possible. | A device list, login history and "Log out other devices". |
| Show products to customers | No public page. | `/p/<link-name>` lists the items you mark public. Tests check that email, phone, stock counts, notes and tags never leave the server. |

These areas went from 21 backend tests at D2 to 68: auth 9 → 26, notifications 0 → 7, public profile 0 → 12, and channel, tag and item-tag management 12 → 23.

### Consistency and accessibility ([#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9), [#14](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/14), [#17](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/17))

- **Page titles:** Every D2 page had the same browser title, "Jack-Of-All-Trades". Each page now names itself ("Sales | Jack-Of-All-Trades", "Security settings | …"), which is the first thing a screen reader announces.
- **Dialogs:** In D2, one stray click outside a dialog closed it and lost the half-filled form, and Tab could wander behind it. Now focus starts in the first field and stays inside the dialog, closing returns focus to the button that opened it, and leaving an edited form asks first.
- **Forms:** Required fields are marked, and errors are linked to their fields and announced. The login and register pages have a show-password toggle. Prices and costs are capped at $9,999,999.99 with a clear message: D2 accepted a $10,000,000 price, and then selling three failed with "Number is out of range".
- **Navigation and look:** The sidebar collapses to an icon bar, Appearance options work with the arrow keys, and all summary cards share one component and one set of fonts and colours.
- **Read aloud:** Any page can be read out, with pause, resume, stop and speed controls, and its status is announced to assistive technology.

Lighthouse scored 100 for accessibility at D2 and still does on every D3 page, including the
Settings, Help, legal and public-profile pages added since. Lighthouse only checks what's on
the page, though, not how it behaves, and our D3 accessibility work was about behaviour. We
checked that by hand, using only the keyboard and VoiceOver, on both versions:

| Check | D2 | D3 |
| --- | --- | --- |
| Open "Add sale" with the keyboard | Focus stays on the page behind the dialog | Focus starts in the first field |
| Press Tab past the last field of a dialog | Focus moves to the page behind it | Focus stays inside the dialog |
| Close a dialog with Esc | Focus is lost; the next Tab starts at the top of the page | Focus returns to the button that opened it |
| Click outside a half-filled form | The form closes and the input is lost | The app asks before discarding changes |
| Submit a form with a mistake (VoiceOver) | Reads the field, not the error | Reads the field and its error |
| Switch pages (VoiceOver) | Every page is "Jack-Of-All-Trades" | Each page announces its name, e.g. "Sales" |

### Reliability of delivery ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10), [#13](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/13))

At D2, CI ran formatting, lint, typecheck and build, with no tests, no time limits and a manual deploy. Now every PR also runs the backend suite (139 tests at D2, 188 now, 200 with #15 and #16). `main` deploys to Render only when everything passes, each job has a time limit, and the first full run took about two minutes. Configuration is documented in `.env.example` templates, and `backend/.env` is ignored by git so passwords can't be committed by accident.

## 4. Reflection

<!-- What worked well, what was harder than expected, and how this affects your path to D4. -->

### What worked well

- **Opening every change as a PR and having a teammate review it:** More eyes on each change caught real bugs before users saw them. The review of [#8](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/8) found that the notification bell returned a server error for every new account, and that a profile-picture upload could fill the server's memory. The review of [#9](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/9) caught a stylesheet rewrite that would have broken the account menu on the live site. The review of [#15](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/15) found that typing a year into a date field could reset the other end of the range to the year 2. Reviews also sparked new work: comments on #8 that the saved currency had no effect led to the currency-exchange PR, #19.
- **Letting CI run the tests, not each author:** The backend tests for #8 had never been run. The new CI job ([#10](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/10)) ran them on that PR and caught 5 failures and 1 error. Since then a failing test blocks the deploy, and the backend suite has grown from 139 tests at D2 to 188, at about a minute per run.
- **Keeping the API contract up to date:** At D2, the contract drifting from the code cost us time. This time every PR that changed the API also updated `docs/api-contracts.md` (#8, #12, #15, #16), so people could build on each other's endpoints without asking.
- **Building on each other's branches:** The analytics work ([#16](https://github.com/dakhmedova30/18-Jack-Of-All-Trades/pull/16)) was one teammate's date filter, extended by another with a channel filter and Revenue by Channel. The second teammate also merged `main` in and resolved the conflicts themselves.

### What was harder than expected

- **One shared stylesheet:** All our styles live in one file of about 2,400 lines. When #9 reorganized it, every open branch conflicted. The analytics branch alone had four conflicting blocks of about 600 lines, and the rewrite deleted rules a live component still used. Most of our merge time went to CSS, not logic.
- **Conflicts git can't see:** Seven PRs were opened within five hours on Nov 5. #16 and #19 both rewrite the analytics service, #15 and #19 both change the sales service, and #18 adds a test for the "Show by" dropdown that #16 removes. Git flags some of these. The test would merge cleanly and then fail, and only a reviewer reading both PRs would spot it.
- **Dates:** We stored days in UTC to keep things simple, but browsers don't make that easy. Chrome's date field reports half-typed years like `0002`, which two of us ran into separately (#15 and #16). And an evening sale in Toronto still counts toward the next UTC day.
- **Showing accessibility progress:** Lighthouse already scored 100 at D2, so it couldn't show what #14 improved: focus, keyboard use and what a screen reader announces. We had to check those by hand on both versions.

### How this affects our path to D4

- **Merge smaller and sooner:** At D2 we said branches stayed separate too long, and it happened again: the analytics branch fell 32 commits behind `main`. For D4 we'll merge `main` into open branches every day and aim to keep a PR open for no more than 2-3 days. The open PRs merge in a planned order: #15 and #16 first, then #19 rebuilt on the new analytics service, then #18 with its analytics test updated.

- **Finish the MVP from feedback:** Reviews left concrete gaps:
  - the currency and time-zone settings are saved but not yet used;
  - expenses aren't tied to a channel, so we can't show profit per channel;
  - "Add / switch account" still says "Coming soon".
  <!-- -  the read-aloud feature (#17) still reads hidden text and covers content; -->
- **Raise the quality bar and document decisions:** Add the frontend tests (#18) to CI, split the stylesheet into one file per page or component, and keep writing the reasoning behind design choices into PR descriptions and the contract, as this report does.
- **Showcase and review:** The public profile (#12) gives outside users something to try without an account, and the demo account's sample data gives TAs and partners a full history to explore. Our written reviews, with reproduction steps and suggested fixes, are the habit D4's code-review goal asks for, and every PR will keep needing one approval.



