// View counter for zerolovesea.top.
// Serves POST /api/view (increment + return count) and GET /api/view?slug=... (read only).
// Backed by Cloudflare D1 (SQLite): atomic `count = count + 1` via UPSERT ... RETURNING.

const OPTOUT_COOKIE = "view_optout";
const MAX_SLUG_LENGTH = 256;

// Same-origin guard for POST. Requests from the site itself always carry an
// `Origin` header matching one of these. Browsers never strip Origin on POST.
const ALLOWED_ORIGINS = new Set([
	"https://zerolovesea.top",
	"https://www.zerolovesea.top",
]);

// Known crawlers / scripted HTTP clients. Legitimate browser UAs never match.
const BOT_UA =
	/bot\b|spider|crawler|crawl|scrape|slurp|headlesschrome|phantomjs|puppeteer|playwright|selenium|python-requests|python-urllib|curl\/|wget\/|libwww|httpclient|okhttp|go-http-client|java\/|jakarta|node-fetch|axios\/|postmanruntime|insomnia|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|redditbot|baiduspider|bingbot|bingpreview|duckduckbot|yandex|sogou|360spider|haosouspider|bytespider|smtbot|petalbot|semrush|ahrefs|mj12|dotbot|rogerbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|ccbot|googleother|google-extended|amazonbot|applebot|imagesift|uptimerobot|pingdom|monitor/i;

function isBot(request) {
	const cf = request.cf ?? {};
	// Available on all Cloudflare plans for proxied domains.
	if (cf.verifiedBot === true) return true;
	// Bot Management score (1-99) is only present when Bot Management is on.
	const score = cf.botManagement?.score;
	if (typeof score === "number" && score < 30) return true;
	return BOT_UA.test(request.headers.get("user-agent") ?? "");
}

function normalizeSlug(slug) {
	if (typeof slug !== "string") return null;
	const s = slug.trim().slice(0, MAX_SLUG_LENGTH);
	return s.length > 0 ? s : null;
}

async function readJson(request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

async function getCount(env, slug) {
	if (!slug) return 0;
	const { results } = await env.DB.prepare(
		"SELECT count FROM views WHERE slug = ?1",
	)
		.bind(slug)
		.all();
	return results[0]?.count ?? 0;
}

async function increment(env, slug) {
	const { results } = await env.DB.prepare(
		"INSERT INTO views (slug, count) VALUES (?1, 1) ON CONFLICT(slug) DO UPDATE SET count = count + 1 RETURNING count",
	)
		.bind(slug)
		.all();
	return results[0]?.count ?? 0;
}

function ipPrefix(ip) {
	const parts = ip.split(".");
	if (parts.length === 4 && parts.every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255)) {
		return parts.slice(0, 3).join(".") + ".0/24";
	}
	if (!ip.includes(":") || !/^[0-9a-f:.]+$/i.test(ip)) return null;
	try {
		const [head, tail] = new URL(`http://[${ip}]/`).hostname.slice(1, -1).split("::");
		const left = head ? head.split(":") : [];
		const right = tail ? tail.split(":") : [];
		const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
		return groups.slice(0, 3).join(":") + "::/48";
	} catch { return null; }
}

function deviceType(ua) {
	if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
	if (/Mobile|iPhone|iPod|Android/i.test(ua)) return "mobile";
	if (/Windows NT|Macintosh|X11|CrOS|Linux/i.test(ua)) return "desktop";
	return null;
}

// Best-effort visit log: timestamp, country/city (Cloudflare IP
// geolocation), the reader's browser language (Accept-Language header) and an
// anonymous visitor id (random UUID from the client, used for unique-visitor
// counts). Never stores the raw IP. Failure here must never break counting.
async function logVisit(env, request, slug, visitorId) {
	const cf = request.cf ?? {};
	const language =
		(request.headers.get("accept-language") ?? "")
			.split(",")[0]
			?.trim()
			.slice(0, 32) || null;
	const fields = [slug, new Date().toISOString(), cf.country ?? null, cf.city ?? null, language, visitorId];
	try {
		await env.DB.prepare(
			"INSERT INTO visits (slug, viewed_at, country, city, language, visitor_id, ip_prefix, device) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		).bind(...fields,
			ipPrefix(request.headers.get("cf-connecting-ipv6") || request.headers.get("cf-connecting-ip") || ""),
			deviceType(request.headers.get("user-agent") || ""),
		).run();
	} catch (error) {
		// Keep recording visits if this Worker is deployed before its schema update.
		if (!/no column named (ip_prefix|device)\b/i.test(String(error))) throw error;
		await env.DB.prepare(
			"INSERT INTO visits (slug, viewed_at, country, city, language, visitor_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		).bind(...fields).run();
	}
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-store",
		},
	});
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		if (url.pathname !== "/api/view") {
			return new Response("Not Found", { status: 404 });
		}

		if (request.method === "GET") {
			const count = await getCount(env, normalizeSlug(url.searchParams.get("slug")));
			return json({ count });
		}

		if (request.method === "POST") {
			const origin = request.headers.get("origin");
			if (origin && !ALLOWED_ORIGINS.has(origin)) {
				return json({ error: "forbidden" }, 403);
			}

			const body = await readJson(request);
			const slug = normalizeSlug(body?.slug);
			if (!slug) return json({ error: "slug required" }, 400);
			const visitorId =
				typeof body?.visitorId === "string"
					? body.visitorId.slice(0, 64) || null
					: null;

			const optedOut = (request.headers.get("cookie") ?? "").includes(
				`${OPTOUT_COOKIE}=1`,
			);

			// Exclude the site owner (opt-out cookie) and crawlers from the count,
			// but still return the current value so the page can render it.
			if (optedOut || isBot(request)) {
				return json({ count: await getCount(env, slug) });
			}

			const count = await increment(env, slug);
			await logVisit(env, request, slug, visitorId).catch(() => {});
			return json({ count });
		}

		return new Response("Method Not Allowed", { status: 405 });
	},
};
