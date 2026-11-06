# Jack-Of-All-Trades - Individual Contributions (D3)

> For each team member: name, role, and specific contributions. Be precise about what you did, not how much you wrote.


> [Specific contributions: features built, PRs reviewed, infrastructure set up, etc.]


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
* Integration fixes on teammates' PRs: moved the "not selling" backend into #22 so the Inventory page no longer went blank (4 tests); updated tests broken by other PRs on #18 and #20, and linked login errors to their fields (#20); fixed the read-aloud bar covering page content (#17) and the sidebar overlapping dialogs (#9).
* Reviews: reviewed #8, #9, #12, #14, #16, #17, #18, #19, #20 and #22 (approved #12, #14 and #16).
* Accessibility and NFR evidence: measured Lighthouse accessibility on the live site (96–100 on every main page) and documented the accessibility, security and production measures in the README (#26).
* Documentation: rewrote the README for D3 (try-it section, current workflows, response to D2 feedback, new screenshots) (#26), wrote sections 1–2 of the product evolution report, and added the team meeting minutes (#25).

**[Name]**, [Role]
> [Specific contributions]

**[Name]**, [Role]
> [Specific contributions]

**[Name]**, [Role]
> [Specific contributions]
