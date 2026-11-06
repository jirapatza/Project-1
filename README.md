# Project 1 — Private historical results dashboard

This is a **separate** project. It does not commit to, configure, deploy or modify `jirapatza/Bombim00`.

## Requirements
Node.js 20 or later. No npm dependencies are required.

## Start

```bash
export PROJECT1_PASSWORD='replace-with-a-long-unique-password'
export PROJECT1_SESSION_SECRET='replace-with-at-least-32-random-characters'
npm start
```

Open http://127.0.0.1:4173. Set `HOST=0.0.0.0` for a trusted hosting environment, `PORT` for the port, and `NODE_ENV=production` when behind HTTPS.

**Important:** Always use HTTPS for any internet deployment. Do not expose the local server directly to the public internet. Authentication is shared-password access (2–3 people can sign in on their own devices), not per-user accounts. Sessions last 30 days. To invalidate all sessions, rotate `PROJECT1_SESSION_SECRET`. Use a trusted private network or access proxy for stronger protection.

## Data

The server reads these existing Bombim00 files only:
- `main/data/all_lotteries.json`
- `runtime-live/lottery_previous_results.json`

The upstream requests are read-only and cached for 60 seconds. If an upstream request fails, the dashboard labels and uses a bundled extract from Bombim00 commit e836193, with results through 2026-11-02. The extract contains only fields needed by the dashboard. History name matching is conservative; if a result cannot be matched reliably it is not attributed to a lottery. The 54-entry catalog is authoritative.

For a private Bombim00 repository, configure `BOMBIM_READ_TOKEN` as a server-side secret: use a fine-grained GitHub token restricted to that repository with **Contents: read-only**. The server fetches only the two files listed above through GitHub's read-only API; the token must never be included in browser code, logs, or this repository. With no token, the public raw URLs continue to be used. Test the live feed with the token before making the source private. A failed fetch still falls back to the labeled cached or bundled snapshot.

## Tests

`npm test` runs local server tests; `node --check server.js` checks syntax. Actual source reachability must be verified from the deployment environment.

## Deployment

Create a **new private GitHub repository** (not a fork that will sync writes to the original). Upload the contents of this directory, then deploy that new repository as a separate Node web service. Build command: none. Start command: `npm start`. Configure `PROJECT1_PASSWORD`, `PROJECT1_SESSION_SECRET`, `NODE_ENV=production`, `HOST=0.0.0.0`. Configure HTTPS and access controls on the hosting provider. Do not copy any GitHub write token from Bombim00.

## Limitations

The initial release provides historical digit frequency, tens/units distribution, observed gaps, a comparison of available records in two windows, and a historical results table. These are descriptive only, not betting recommendations. The data feed is a finite history snapshot; the site does not claim it contains every past draw. Source matching may require validation for some catalog entries before claiming full per-lottery coverage.

## Dashboard

- หน้าแรก shows the lottery count, recent results, recent digit frequencies and the latest formula and publisher checks.
- คำนวณรายหวย offers one selection per lottery and four experimental formulas adapted from the separate `-1` project. The weekday formula uses the selected date and no past results. The sum and pair-matrix formulas require the previous draw's top three and bottom two; the frequency formula counts valid digits from up to ten earlier draws. The matrix and frequency rules are explicit adaptations: in the original project, the matrix falls through to the sum calculation and its frequency-labelled rule does not actually count frequencies. No hard-coded accuracy scores or default results are used.
- A fifth formula is available only for Laos Development: add the previous draw's two-digit top and bottom numbers, divide by three, and take the units digit and the next digit (after 9, wrap to 0). The previous draw's two-digit top is taken from the last two digits of its explicit three-digit top. For example, 06 + 18 = 24, 24 ÷ 3 = 8, yielding 8 and 9. The user-provided clip summary does not state how to handle a remainder, so no numbers are generated when the sum is not divisible by three. The app uses the latest earlier record it can find; that record is not independently verified as the immediately preceding draw, so the displayed date needs checking. This formula provides single digits only; it does not assert two- or three-digit picks.
- The calculator reads the existing read-only history from Bombim00, allows 10, 20 or 30 test draws, and uses only earlier draws for each test. A conflicting most-recent draw blocks formulas that require it rather than substituting an older draw. A missing result is shown as missing, not as a loss; leading zeroes are preserved. It displays the number of matched and conflicting draws, so the range selected is not a promise that enough history exists. The weekday formula is available regardless of history. These are experimental transformations, not evidence of predictive accuracy.
- The separate v1.0.0 Laos Development test remains available. It checks running digits and up to ten exact three-digit candidates against 30 target draws, using 30 earlier draws each time.
- สถิติย้อนหลัง filters the Bombim00 archive by lottery, end date, and 10, 20 or 30 draws. Conflicting rows are withheld.
- เลขดังรายสำนัก contains 17 manually reviewed entries from seven named publishers for four lotteries on 3–4 November 2026. It compares exact picks within the same lottery and date and links to the evidence. Running digits without a stated outcome category are displayed without scoring. Source collection times are labels, not independently certified publication timestamps. New picks are not collected automatically.

The optional `POSTHOG_PROJECT_TOKEN` enables aggregate menu-selection events to the US PostHog ingestion host. No lottery selections, draw dates or user identities are attached to these events. Leave the variable empty to keep events disabled.

## Laos development snapshot pilot (v1.0.0)

Run from the project directory with Node 20 or newer. Use a verified future draw
date in Thailand, and keep the result file in persistent private storage:

    npm run snapshot -- create lao-history-63.json YYYY-MM-DD snapshot.json
    npm run snapshot -- check snapshot.json results.json

The bundled 63 records cover 2026-08-07 through 2026-11-04. Refresh the input
with verified results before using it for a new draw. Input is an array of
objects with date (YYYY-MM-DD), bottom2 (two-character string), and top3
(three-character string). Preserve leading zeros. The pilot ranks two
individual running digits and up to ten exact three-digit results. These
rankings are experimental. Run the command before the target day begins in
Thailand. The command rejects overwriting an existing snapshot file.

This manual tool is separate from the hosted web server and does not schedule
jobs. Local timestamps are not independently attested.

Historical sources:
- https://xn--22c9aba6ftf0bc8d.com/สถิติหวยลาวพัฒนา (first 60 records)
- https://lottoth.co/lottery/laosdevelops/history (2–4 November cross-reference)
