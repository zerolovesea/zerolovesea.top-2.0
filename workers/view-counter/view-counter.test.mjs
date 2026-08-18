import { expect, test } from "bun:test";
import worker from "./src/index.js";

// In-memory fake of the D1 binding (the SQL statements the worker uses).
function makeDB(initial = {}) {
	const store = new Map(Object.entries(initial));
	const visits = [];
	return {
		prepare(sql) {
			return {
				bind(...args) {
					const slug = args[0];
					return {
						async all() {
							if (sql.includes("INSERT INTO views")) {
								const next = (store.get(slug) ?? 0) + 1;
								store.set(slug, next);
								return { results: [{ count: next }] };
							}
							if (sql.includes("SELECT count")) {
								return {
									results: store.has(slug) ? [{ count: store.get(slug) }] : [],
								};
							}
							return { results: [] };
						},
						async run() {
							if (sql.includes("INSERT INTO visits")) {
								visits.push({
									slug: args[0],
									viewed_at: args[1],
									country: args[2],
									city: args[3],
									language: args[4],
									visitor_id: args[5],
								});
							}
							return { meta: {} };
						},
					};
				},
			};
		},
		get size() {
			return store.size;
		},
		get visits() {
			return visits;
		},
	};
}

function env(initial) {
	const db = makeDB(initial);
	return { DB: db, db };
}

function postRequest(slug, { ua = "Mozilla/5.0", origin, cookie, lang, visitorId } = {}) {
	const headers = { "content-type": "application/json" };
	if (origin) headers.origin = origin;
	if (cookie) headers.cookie = cookie;
	if (ua) headers["user-agent"] = ua;
	if (lang) headers["accept-language"] = lang;
	return new Request("https://zerolovesea.top/api/view", {
		method: "POST",
		headers,
		body: JSON.stringify(visitorId ? { slug, visitorId } : { slug }),
	});
}

test("increments from 0 and returns the new count", async () => {
	const e = env();
	const res = await worker.fetch(
		postRequest("写在第一天", { origin: "https://zerolovesea.top" }),
		e,
	);
	expect(res.status).toBe(200);
	expect((await res.json()).count).toBe(1);

	const res2 = await worker.fetch(
		postRequest("写在第一天", { origin: "https://zerolovesea.top" }),
		e,
	);
	expect((await res2.json()).count).toBe(2);
});

test("logs a visit row with time, language, geo and visitor id on a counted view", async () => {
	const e = env();
	await worker.fetch(
		postRequest("写在第一天", {
			origin: "https://zerolovesea.top",
			lang: "zh-CN,zh;q=0.9,en;q=0.8",
			visitorId: "vis-123",
		}),
		e,
	);
	expect(e.db.visits).toHaveLength(1);
	const visit = e.db.visits[0];
	expect(visit.slug).toBe("写在第一天");
	expect(visit.language).toBe("zh-CN");
	expect(visit.visitor_id).toBe("vis-123");
	// viewed_at is an ISO timestamp; country/city default to null in the fake.
	expect(Number.isNaN(Date.parse(visit.viewed_at))).toBe(false);
	expect(visit.country).toBeNull();
});

test("logs a null visitor id when the client sends none", async () => {
	const e = env();
	await worker.fetch(
		postRequest("写在第一天", { origin: "https://zerolovesea.top" }),
		e,
	);
	expect(e.db.visits).toHaveLength(1);
	expect(e.db.visits[0].visitor_id).toBeNull();
});

test("does not log visits for bot user agents", async () => {
	const e = env({ 写在第一天: 7 });
	await worker.fetch(
		postRequest("写在第一天", {
			origin: "https://zerolovesea.top",
			ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		}),
		e,
	);
	expect(e.db.visits).toHaveLength(0);
});

test("does not log visits when the opt-out cookie is present", async () => {
	const e = env({ 写在第一天: 7 });
	await worker.fetch(
		postRequest("写在第一天", {
			origin: "https://zerolovesea.top",
			cookie: "view_optout=1; theme=dark",
		}),
		e,
	);
	expect(e.db.visits).toHaveLength(0);
});

test("skips increment for bot user agents", async () => {
	const e = env({ 写在第一天: 7 });
	const res = await worker.fetch(
		postRequest("写在第一天", {
			origin: "https://zerolovesea.top",
			ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		}),
		e,
	);
	expect((await res.json()).count).toBe(7);
});

test("skips increment when the opt-out cookie is present", async () => {
	const e = env({ 写在第一天: 7 });
	const res = await worker.fetch(
		postRequest("写在第一天", {
			origin: "https://zerolovesea.top",
			cookie: "view_optout=1; theme=dark",
		}),
		e,
	);
	expect((await res.json()).count).toBe(7);
});

test("rejects cross-origin POSTs", async () => {
	const e = env();
	const res = await worker.fetch(
		postRequest("写在第一天", { origin: "https://evil.example" }),
		e,
	);
	expect(res.status).toBe(403);
});

test("GET returns 0 for an unknown slug", async () => {
	const res = await worker.fetch(
		new Request("https://zerolovesea.top/api/view?slug=missing"),
		env(),
	);
	expect((await res.json()).count).toBe(0);
});
