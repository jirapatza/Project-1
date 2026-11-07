# Historical data source audit (2026-11-08)

## Scope
Project-1 remains independent from Bombim00. This document covers read-only archival data and descriptive statistics only. Do not change notification workers, schedulers, or the source repository through this project.

## Verified repository facts
- `Project-1/server.js` serves authenticated `GET /api/catalog` and `GET /api/history`. It currently loads both through `readBombimSource()`, caches successful fetches for 60 seconds, and falls back to bundled `bombim00-*.json` extracts if the upstream fails. The response header `X-Project1-Data: archive` signals the fallback.
- `Project-1/bombim-source.js` reads the Bombim00 `main` catalog and `runtime-live` history from GitHub; with `BOMBIM_READ_TOKEN` it uses GitHub's read-only Contents API.
- `Bombim00/cloudflare/src/worker.js` exposes `GET /health` only; it does NOT currently expose a public history API. The worker still reads and publishes runtime snapshots through GitHub. Its D1 binding is used for its own durable worker state; do not assume it is a historical-results database.
- As of this audit, the GitHub repository metadata for `jirapatza/Project-1` reports `visibility: public`. Do not put private tokens, sensitive configuration, or data into the repository.

## Migration gate — no unverified endpoint substitutions
1. Identify an authorized, stable, read-only archival JSON service **separate from** Bombim00's alert delivery paths. Do not use `/health` as a results endpoint.
2. Confirm its schema with live responses and at least one known published draw. Required fields for descriptive history: canonical lottery ID, draw date (Asia/Bangkok calendar when applicable), published status, result strings preserving leading zeros, origin, observed timestamp, and provenance.
3. Reject future, pending, conflicting, malformed, and duplicate records; distinguish "no published data yet" from an HTTP error. A valid result cannot be inferred from schedule time alone.
4. Test retries, timeouts, 403, 404, invalid JSON, stale data, and partial upstream outage. Ensure server-side secrets never appear in responses or logs.
5. Maintain labeled cache/archival fallback with a visible source timestamp. Never label a bundled archive as live.
6. Test archival display endpoints in isolation before switching the existing Project-1 data reader. Keep Bombim00 write operations and notification machinery untouched.

## Current decision
**Do not flip the source URL yet.** No independently verified production archival JSON endpoint has been established. The current GitHub history path is the documented working mechanism in the source code, but runtime reachability requires separate operational verification. The next implementation change is conditional on a verified read-only endpoint and schema; until then, existing behavior stays unchanged.

This migration plan is for descriptive historical data integrity, not outcome predictions or betting recommendations.
