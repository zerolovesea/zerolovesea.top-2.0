# view-counter

Per-post view counter for zerolovesea.top, served on the `zerolovesea.top/api/*`
route (same pattern as `workers/image-proxy`). Backed by Cloudflare D1 (SQLite).

## Endpoints

- `POST /api/view` — body `{ "slug": "..." }`. Increments the count atomically
  and returns `{ "count": number }`. Excludes the owner (via the `view_optout`
  cookie) and crawlers (Cloudflare `verifiedBot` + User-Agent blocklist), but
  still returns the current count so the page can render it.
- `GET /api/view?slug=...` — read-only, returns `{ "count": number }` (0 if unseen).

The slug is the Astro content `id` (filename without extension), identical for
the Chinese and English posts, so `/slug` and `/en/slug` share one counter.

## First-time setup

```bash
cd workers/view-counter

# 1. create the D1 database (prints a database_id)
bunx wrangler d1 create zerolovesea-view-counter

# 2. paste the database_id into wrangler.jsonc (replace "<YOUR_DATABASE_ID>")

# 3. apply the schema
bunx wrangler d1 execute zerolovesea-view-counter --file=./schema.sql --remote

# 4. deploy
bunx wrangler deploy
```

## Tests

```bash
bun test workers/view-counter/view-counter.test.mjs
```
