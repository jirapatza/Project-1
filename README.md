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

The upstream requests are read-only and cached for 60 seconds. The project does not scrape, update, or duplicate source records. History name matching is conservative; if a result cannot be matched reliably it is not attributed to a lottery. The 54-entry catalog is authoritative.

## Tests

`npm test` runs local server tests; `node --check server.js` checks syntax. Actual source reachability must be verified from the deployment environment.

## Deployment

Create a **new private GitHub repository** (not a fork that will sync writes to the original). Upload the contents of this directory, then deploy that new repository as a separate Node web service. Build command: none. Start command: `npm start`. Configure `PROJECT1_PASSWORD`, `PROJECT1_SESSION_SECRET`, `NODE_ENV=production`, `HOST=0.0.0.0`. Configure HTTPS and access controls on the hosting provider. Do not copy any GitHub write token from Bombim00.

## Limitations

The initial release provides historical digit frequency, tens/units distribution, observed gaps, a comparison of available records in two windows, and a historical results table. These are descriptive only, not betting recommendations. The data feed is a finite history snapshot; the site does not claim it contains every past draw. Source matching may require validation for some catalog entries before claiming full per-lottery coverage.

## Formula lab

Select a lottery, a built-in versioned rule and 10, 20, 30 or all available target draws.
Each target date uses only earlier records for the same lottery. Duplicate dates count
once, conflicting or missing numbers are skipped, and the results show the count
tested and the count matching the recorded two-digit number. These sample rules
are for retrospective evaluation. The upstream snapshot may omit draws, so
“previous draw” refers to the previous date present in that snapshot.
