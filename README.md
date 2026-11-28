# Project 1 — Historical results dashboard

This is a **separate** project. It does not commit to, configure, deploy or modify `jirapatza/Bombim00`.

## Requirements
Node.js 20 or later. The web dashboard needs no installed packages. The automatic PNG command needs Playwright Core and Chromium.

## Start

```bash
npm start
```

Open http://127.0.0.1:4173. Set `HOST=0.0.0.0` for a trusted hosting environment, `PORT` for the port, and `NODE_ENV=production` when behind HTTPS.

The dashboard opens directly without a password or session. Anyone who can reach the deployment can load the dashboard and its data endpoints. Repository visibility controls source access separately.

## Data

Set `PROJECT1_HISTORY_API` to the HTTPS origin of the separate Project-1 Cloudflare Worker. The Worker reads these public Bombim00 files every five minutes and keeps the latest usable catalog and history together in a dedicated D1 database:

- `main/data/all_lotteries.json`
- `runtime-live/lottery_previous_results.json`

The Worker serves only `GET /api/catalog` and `GET /api/history` and forwards the snapshot time. It returns 503 if the snapshot is older than 20 minutes. Project-1 caches successful reads for 60 seconds, coalesces concurrent requests, and tries the direct Bombim00 source if the Worker fails or serves an expired snapshot. If both reads fail, it falls back to labeled stale cache or bundled data. `GET /api/history-quality` reports data origin and match, date, duplicate and conflict counts.

For direct reads, the server uses the same two files. For private source access in this mode, `BOMBIM_READ_TOKEN` is a server-side fine-grained token restricted to read-only Contents for Bombim00. If an authenticated direct read fails, the server tries the same files at their public URL without credentials. The Worker uses the public files and is independent of that token.

Use `cloudflare/wrangler.jsonc` and `cloudflare/schema.sql` for the Worker and its D1 binding. The mirror serves the current history window from the source, which can be shorter than the requested historical range.

The server includes a supplemental archive of 690 accepted published draws captured on
22 November 2026 from [ผลหวย.com](https://xn--t3cmiit.com) and
[LotteryChecks](https://lotterychecks.com), plus 428 Thai lotto draws from the
sanook dataset. Each row retains its result page URL. It supplements historical
views and backtests for 14 catalog items. The API fetch timestamp describes the
primary snapshot. The archive is fixed and provides no current-day guide picks. The regular history checks
continue to flag conflicts and duplicates when source records overlap.

## Tests

`npm test` runs the local suite; CI uses Node.js 22 so it also runs the SQLite integration check. `node --check server.js` checks syntax. Verify source reachability from the deployment environment.

## Deployment

Deploy the private Project-1 repository as a separate Node web service. Build command: `npm test`. Start command: `npm start`. Set `HOST=0.0.0.0` for Render and use its HTTPS endpoint. Keep read credentials in server environment variables.

## Limitations

The initial release provides historical digit frequency, tens/units distribution, observed gaps, a comparison of available records in two windows, and a historical results table. These are descriptive only, not betting recommendations. The data feed is a finite history snapshot; the site does not claim it contains every past draw. Source matching may require validation for some catalog entries before claiming full per-lottery coverage.

## Dashboard

- หน้าแรก shows the lottery count, recent results, recent digit frequencies and the latest formula and publisher checks.
- คำนวณรายหวย offers one selection per lottery and four experimental formulas adapted from the separate `-1` project. The weekday formula uses the selected date and no past results. The sum and pair-matrix formulas require the previous draw's top three and bottom two; the frequency formula counts valid digits from up to ten earlier draws. The matrix and frequency rules are explicit adaptations: in the original project, the matrix falls through to the sum calculation and its frequency-labelled rule does not actually count frequencies. No hard-coded accuracy scores or default results are used.
- A fifth formula is available only for Laos Development: add the previous draw's two-digit top and bottom numbers, divide by three, and take the units digit and the next digit (after 9, wrap to 0). The previous draw's two-digit top is taken from the last two digits of its explicit three-digit top. For example, 06 + 18 = 24, 24 ÷ 3 = 8, yielding 8 and 9. The user-provided clip summary does not state how to handle a remainder, so no numbers are generated when the sum is not divisible by three. The app uses the latest earlier record it can find; that record is not independently verified as the immediately preceding draw, so the displayed date needs checking. This formula provides single digits only; it does not assert two- or three-digit picks.
- The calculator reads the existing read-only history from Bombim00, allows 10, 20 or 30 test draws, and uses only earlier draws for each test. A conflicting most-recent draw blocks formulas that require it rather than substituting an older draw. A missing result is shown as missing, not as a loss; leading zeroes are preserved. It displays the number of matched and conflicting draws, so the range selected is not a promise that enough history exists. The weekday formula is available regardless of history. These are experimental transformations, not evidence of predictive accuracy.
- The separate v1.0.0 Laos Development test remains available. It checks running digits and up to ten exact three-digit candidates against 30 target draws, using 30 earlier draws each time.
- สถิติย้อนหลัง filters the Bombim00 archive by lottery, end date, and 10, 20 or 30 draws. Conflicting rows are withheld.
- สูตรที่สร้างเอง builds a formula from a base leaf (a constant, the draw date, the birth date, or digits of the previous top prize) plus up to six binary steps (add, subtract, multiply, concatenate). Formulas are stored in this browser only, can be edited, disabled and deleted, and are never sent to the server. The backtest scores 10, 20 or 30 draws against the draw before each target, so changing a target result or any later result cannot change the numbers that target produced. The random baseline is the theoretical share of the pool covered by the formula's numbers, not a win probability. The notify toggle keeps a subscription in the same browser storage and lists matches for the newest draw on this page only; no message is sent outside the page and no scheduler runs the formulas.
- เลขดังรายสำนัก contains 17 manually reviewed entries from seven named publishers for four lotteries on 3–4 November 2026. It compares exact picks within the same lottery and date and links to the evidence. Running digits without a stated outcome category are displayed without scoring. Source collection times are labels, not independently certified publication timestamps. New picks are not collected automatically.

The optional `POSTHOG_PROJECT_TOKEN` enables aggregate menu-selection events to the US PostHog ingestion host. No lottery selections, draw dates or user identities are attached to these events. Leave the variable empty to keep events disabled.

## Guide studio and PNG runner

Open `/studio` to enter numbers or import a draft from the formula tab. The studio exports a 900 × 1200 PNG and stores the saved layout in the current browser. The browser clears saved draft values after 24 hours on the next studio open or load.

The automatic runner uses the same Canvas exporter. Install dependencies with `npm ci` and provide an installed Chromium via `GUIDE_CHROMIUM_PATH` if needed.

```bash
node guide-poll.mjs INPUT_JSON_OR_HTTPS_URL TRANSIENT_DIRECTORY [--watch]
```

The input provides `catalog`, `weekdays`, `confirmedDraws`, `guides` and optionally `template`. `--watch` reads updated input after each completed poll, with a default interval of 60 seconds. The runner only accepts independently confirmed current Bangkok draw dates within its per-draw window. It uses a dedicated transient directory supporting atomic hard links. Published pairs expire after 24 hours and the runner purges them on its next poll. A verified feed and an always-on host are required for production collection.

The separate `project1-guide-inputs` Worker uses the live D1 history and catalog. It prefetches exact-date published data for supported markets, polls every five minutes and provides `GET /api/guide-inputs`. A complete entry can enter `confirmedDraws` and `guides` only in its render window. The `entries` array distinguishes provider-backed input, incomplete data and formula drafts awaiting date confirmation. Render proxies the read-only endpoint when `PROJECT1_GUIDE_API` is configured. The guide schema stores current-day input for up to 24 hours. The guidance job does not write or delete the history snapshot.


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

When a supported stock source is unavailable, the studio can import a complete
formula draft during the usual render window. Drafts keep their label in the
studio and use a `guide-formula-` PNG filename. The Worker exposes these drafts
in `entries`; automation still consumes only `guides` and `confirmedDraws`.
The studio accepts older Worker drafts with six triples and uses the first four
for the poster slots.

Stock source review on 23 November 2026: [LekLNW](https://leklnw.com/huay-ai-stock/)
returned HTTP 503. [Leksod's Nikkei morning](https://leksod.com/stocks/nikkei_am/)
and [afternoon](https://leksod.com/stocks/nikkei_pm/) pages distinguish the rounds
but exposed draw dates without a verifiable publication time for the picks.
The [Huaysong China article](https://huaysong.net/huaystock/content/หวยหุ้นจีน-23-11-69)
also lacked a verifiable pre-close timestamp. These candidates remain outside the
collector until individual rounds and publication times can be verified.
