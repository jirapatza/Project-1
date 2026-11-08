# Project 1 — Architecture

- Independent repository and deployment, with no write access to Bombim00.
- Node HTTP service serves a responsive Thai UI and acts as a read-only proxy for the two existing upstream JSON files.
- Only existing canonical 54 lottery catalog entries appear; no generated lottery catalog or new scraping.
- Direct dashboard access, CSP and same-origin data routes.
- Per-lottery historical analysis: units frequency, tens frequency, observed gaps, window comparison, history table. Records with ambiguous names remain unmatched.
- Next hardening steps: validate exact name mapping against original upstream behavior, verify the private repository and its HTTPS deployment.
- Original repository `jirapatza/Bombim00` must remain untouched.
