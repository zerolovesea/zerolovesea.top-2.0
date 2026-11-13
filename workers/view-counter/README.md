# view-counter

Per-post view counter for zerolovesea.top, served on the `zerolovesea.top/api/*`
route (same pattern as `workers/image-proxy`). Backed by Cloudflare D1 (SQLite).

## Endpoints

- `POST /api/view` — body `{ "slug": "..." }`. Increments the count atomically
  and returns `{ "count": number }`. Excludes the owner (via the `view_optout`
  cookie) and crawlers (Cloudflare `verifiedBot` + User-Agent blocklist), but
  still returns the current count so the page can render it. Every counted
  visit is also logged to the `visits` table (best-effort, see below).
- `GET /api/view?slug=...` — read-only, returns `{ "count": number }` (0 if unseen).

The slug is the Astro content `id` (filename without extension), identical for
the Chinese and English posts, so `/slug` and `/en/slug` share one counter.

## Data stored (D1)

- `views(slug, count)` — the atomic counter shown on the page.
- `visits(id, slug, viewed_at, country, city, language, visitor_id)` — one row
  per counted visit. `viewed_at` is a UTC ISO timestamp; `country`/`city` come
  from Cloudflare's IP geolocation (`request.cf.country` / `request.cf.city`,
  city is best-effort); `language` is the first tag of the browser
  `Accept-Language` header; `visitor_id` is an anonymous random UUID issued by
  the client (used to compute unique visitors). Raw IPs are never stored. Rows
  are only written for counted visits (bots and the opted-out owner are
  skipped). A visit-log failure never breaks counting.

> If you already ran the earlier schema (without `visitor_id`), add the column
> once to the production database:
>
> ```bash
> bunx wrangler d1 execute zerolovesea-view-counter \
>   --command "ALTER TABLE visits ADD COLUMN visitor_id TEXT;" --remote
> ```
>
> Old rows keep `visitor_id = NULL`; they still count toward 访问次数 but not
> toward 独立访客.

### Example queries

```bash
# all detail for one post (latest first)
bunx wrangler d1 execute zerolovesea-view-counter \
  --command "SELECT viewed_at, country, city, language FROM visits WHERE slug='写在第一天' ORDER BY id DESC LIMIT 50;" --remote

# views per country (last 30 days)
bunx wrangler d1 execute zerolovesea-view-counter \
  --command "SELECT country, COUNT(*) AS n FROM visits WHERE julianday(viewed_at) >= julianday('now','-30 days') GROUP BY country ORDER BY n DESC;" --remote

# views per language
bunx wrangler d1 execute zerolovesea-view-counter \
  --command "SELECT language, COUNT(*) AS n FROM visits GROUP BY language ORDER BY n DESC;" --remote

# hourly trend (UTC hours)
bunx wrangler d1 execute zerolovesea-view-counter \
  --command "SELECT substr(viewed_at, 12, 2) AS hour, COUNT(*) AS n FROM visits GROUP BY hour ORDER BY hour;" --remote
```

`--remote` targets the production database; drop it for local dev. Use the D1
console in the Cloudflare dashboard for point-and-click browsing.

## First-time setup

```bash
cd workers/view-counter

# 1. create the D1 database (prints a database_id)
bunx wrangler d1 create zerolovesea-view-counter

# 2. paste the database_id into wrangler.jsonc (replace "<YOUR_DATABASE_ID>")

# 3. apply the schema (idempotent — safe to re-run after schema.sql changes)
bunx wrangler d1 execute zerolovesea-view-counter --file=./schema.sql --remote

# 4. deploy
bunx wrangler deploy
```

## Tests

```bash
bun test workers/view-counter/view-counter.test.mjs
```

### 访问明细字段

`ip_prefix` 仅保存 IPv4 /24 或 IPv6 /48 网段；`device` 只保存从浏览器标识推断的手机、平板、电脑类别。不会保存完整 IP 或浏览器标识。历史记录这两列为空。

现有生产数据库先在此目录执行 `bunx wrangler d1 migrations apply zerolovesea-view-counter --remote`，再用 `bunx wrangler deploy` 发布此计数 Worker。新建数据库若直接用当前 `schema.sql` 初始化，已包含这些列，无需再运行这条迁移。
