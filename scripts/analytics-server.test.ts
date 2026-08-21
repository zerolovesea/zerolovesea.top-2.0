import { expect, test } from "bun:test";
import { buildDashboardData, buildWindows, serve } from "./analytics-server";

// Fake D1 runner: per-visit rows statement returns canned visits (two unique
// visitor ids, "aaa" visits twice 10 min apart = one session); distribution
// statements (GROUP BY) return canned rows.
function fakeRun(statements: string[]) {
	return statements.map((sql) => {
		if (sql.includes("viewed_at AS t")) {
			return [
				{ t: "2026-08-18T00:30:00.000Z", v: "aaa" },
				{ t: "2026-08-18T00:40:00.000Z", v: "aaa" },
				{ t: "2026-08-18T01:30:00.000Z", v: "bbb" },
			];
		}
		if (sql.includes("GROUP BY")) {
			return [{ k: "中国", n: 5, u: 3 }, { k: "美国", n: 2, u: 2 }, { k: null, n: 1, u: 1 }];
		}
		return [];
	});
}

const NOW = new Date("2026-08-18T12:00:00Z");

test("buildWindows produces the six expected windows with ISO boundaries", () => {
	const windows = buildWindows(NOW);
	expect(windows.map((w) => w.label)).toEqual([
		"近24小时",
		"今天",
		"近7天",
		"近15天",
		"近30天",
		"近半年",
	]);
	expect(windows[0].since).toBe("2026-08-17T12:00:00.000Z");
	expect(windows[5].since).toBe("2026-02-19T12:00:00.000Z");
	// "今天" starts at local midnight (UTC in this test environment).
	expect(new Date(windows[1].since).getHours()).toBe(0);
});

test("buildDashboardData returns visitors, sessions, views, timeseries and distributions", async () => {
	const data = await buildDashboardData(fakeRun, NOW);
	const labels = Object.keys(data.windows);
	expect(labels).toHaveLength(6);

	// 近30天 is the machine-timezone-safe window: all three fake views fall in it.
	const w30 = data.windows["近30天"];
	expect(w30.views).toBe(3); // page views
	expect(w30.visitors).toBe(2); // "aaa" seen twice is one visitor
	expect(w30.visits).toBe(2); // sessions: aaa(10min gap)=1, bbb=1

	for (const label of labels) {
		const w = data.windows[label];
		expect(typeof w.views).toBe("number");
		expect(typeof w.visitors).toBe("number");
		expect(typeof w.visits).toBe("number");
		expect(w.visitors).toBeLessThanOrEqual(w.visits);
		expect(w.visits).toBeLessThanOrEqual(w.views);
		expect(w.timeseries.labels.length).toBeGreaterThan(0);
		expect(w.timeseries.labels.length).toBe(w.timeseries.values.length);
		expect(w.timeseries.labels.length).toBe(w.timeseries.uniques.length);
		w.timeseries.uniques.forEach((u, i) => {
			expect(u).toBeLessThanOrEqual(w.timeseries.values[i]);
		});
		expect(w.country).toHaveLength(3);
		expect(w.posts).toHaveLength(3);
		expect(w.posts[0].u).toBe(3); // per-post unique visitors
		expect(w.city[0].u).toBe(3); // per-city unique visitors
		expect(w.language).toHaveLength(3);
	}
});

test("HTTP server serves dashboard, echarts vendor and /api/data with cache", async () => {
	const server = serve(fakeRun, 0);
	const base = `http://127.0.0.1:${server.port}`;
	try {
		const html = await fetch(`${base}/`).then((r) => r.text());
		expect(html).toContain("ZeroLoveSeA");
		expect(html).toContain("/vendor/echarts.min.js");

		const vendor = await fetch(`${base}/vendor/echarts.min.js`).then((r) => r.text());
		expect(vendor.length).toBeGreaterThan(1000);
		expect(vendor).toContain("echarts");

		const data = await fetch(`${base}/api/data`).then((r) => r.json());
		expect(data.windows["近7天"].timeseries.labels.length).toBeGreaterThan(0);
		expect(data.windows["近7天"].posts[0].u).toBeDefined();
		expect(data.cached).toBe(false);

		const cached = await fetch(`${base}/api/data`).then((r) => r.json());
		expect(cached.cached).toBe(true);

		const refreshed = await fetch(`${base}/api/data?refresh=1`).then((r) => r.json());
		expect(refreshed.cached).toBe(false);
	} finally {
		server.stop();
	}
});

test("custom range endpoint returns a 自定义 window and validates input", async () => {
	const server = serve(fakeRun, 0);
	const base = `http://127.0.0.1:${server.port}`;
	try {
		const start = encodeURIComponent("2026-08-10T00:00:00.000Z");
		const end = encodeURIComponent("2026-08-18T12:00:00.000Z");
		const d = await fetch(`${base}/api/data?start=${start}&end=${end}`).then((r) => r.json());
		expect(d.windows["自定义"]).toBeDefined();
		expect(d.windows["自定义"].views).toBe(3);
		expect(d.windows["自定义"].visitors).toBe(2);
		expect(d.windows["自定义"].visits).toBe(2); // aaa(10min)=1 session, bbb=1
		expect(d.windows["自定义"].timeseries.labels.length).toBeGreaterThan(0);
		expect(d.windows["自定义"].posts[0].u).toBe(3);
		expect(d.cached).toBe(false);

		// start >= end → rejected
		const bad = await fetch(`${base}/api/data?start=${end}&end=${start}`).then((r) => r.json());
		expect(bad.error).toBeDefined();

		// range > 366 days → rejected
		const far = encodeURIComponent("2024-01-01T00:00:00.000Z");
		const tooLong = await fetch(`${base}/api/data?start=${far}&end=${end}`).then((r) => r.json());
		expect(tooLong.error).toBeDefined();
	} finally {
		server.stop();
	}
});

test("ranking endpoint pages rows by offset and validates input", async () => {
	const server = serve(fakeRun, 0);
	const base = `http://127.0.0.1:${server.port}`;
	try {
		const start = encodeURIComponent("2026-08-10T00:00:00.000Z");
		const end = encodeURIComponent("2026-08-18T12:00:00.000Z");
		const off0 = await fetch(`${base}/api/ranking?k=posts&start=${start}&end=${end}&off=0`).then((r) => r.json());
		expect(off0.key).toBe("posts");
		expect(off0.rows).toHaveLength(3);
		expect(off0.offset).toBe(0);

		const off10 = await fetch(`${base}/api/ranking?k=city&start=${start}&end=${end}&off=10`).then((r) => r.json());
		expect(off10.rows).toHaveLength(3); // fake runner returns rows regardless of offset
		expect(off10.offset).toBe(10);

		// missing params / invalid range / unknown key rejected
		const bad1 = await fetch(`${base}/api/ranking?k=posts`).then((r) => r.json());
		expect(bad1.error).toBeDefined();
		const bad2 = await fetch(`${base}/api/ranking?k=posts&start=${end}&end=${start}`).then((r) => r.json());
		expect(bad2.error).toBeDefined();
		const bad3 = await fetch(`${base}/api/ranking?k=foo&start=${start}&end=${end}`).then((r) => r.json());
		expect(bad3.error).toBeDefined();
	} finally {
		server.stop();
	}
});
