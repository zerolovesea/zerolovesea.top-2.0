import { expect, test } from "bun:test";
import worker from "./src/index.js";

// In-memory fake of the D1 binding (only the two SQL statements the worker uses).
function makeDB(initial = {}) {
	const store = new Map(Object.entries(initial));
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
					};
				},
			};
		},
		get size() {
			return store.size;
		},
	};
}

function env(initial) {
	return { DB: makeDB(initial) };
}

function postRequest(slug, { ua = "Mozilla/5.0", origin, cookie } = {}) {
	const headers = { "content-type": "application/json" };
	if (origin) headers.origin = origin;
	if (cookie) headers.cookie = cookie;
	if (ua) headers["user-agent"] = ua;
	return new Request("https://zerolovesea.top/api/view", {
		method: "POST",
		headers,
		body: JSON.stringify({ slug }),
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
