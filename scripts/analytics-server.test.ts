import { expect, test } from "bun:test";
import { buildDashboardData, buildWindows, serve } from "./analytics-server";

// Fake D1 runner: per-visit rows statement returns canned visits (two unique
// visitor ids); distribution statements (GROUP BY) return canned rows.
function fakeRun(statements: string[]) {
	return statements.map((sql) => {
		if (sql.includes("viewed_at AS t")) {
			return [
				{ t: "2026-08-18T00:30:00.000Z", v: "aaa" },
				{ t: "2026-08-18T01:30:00.000Z", v: "aaa" },
				{ t: "2026-08-18T02:30:00.000Z", v: "bbb" },
			];
		}
		if (sql.includes("GROUP BY")) {
			return [{ k: "中国", n: 5 }, { k: "美国", n: 2 }, { k: null, n: 1 }];
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

test("buildDashboardData returns visits, visitors, timeseries, distributions and calendar", async () => {
	const data = await buildDashboardData(fakeRun, NOW);
	const labels = Object.keys(data.windows);
	expect(labels).toHaveLength(6);

	// 近30天 is the machine-timezone-safe window: all three fake visits fall in it.
	const w30 = data.windows["近30天"];
	expect(w30.visits).toBe(3);
	expect(w30.visitors).toBe(2); // "aaa" seen twice is one visitor

	for (const label of labels) {
		const w = data.windows[label];
		expect(typeof w.visits).toBe("number");
		expect(typeof w.visitors).toBe("number");
		expect(w.visitors).toBeLessThanOrEqual(w.visits);
		expect(w.timeseries.labels.length).toBeGreaterThan(0);
		expect(w.timeseries.labels.length).toBe(w.timeseries.values.length);
		expect(w.timeseries.labels.length).toBe(w.timeseries.uniques.length);
		w.timeseries.uniques.forEach((u, i) => {
			expect(u).toBeLessThanOrEqual(w.timeseries.values[i]);
		});
		expect(w.country).toHaveLength(3);
		expect(w.posts).toHaveLength(3);
		expect(w.language).toHaveLength(3);
		expect(w.city).toHaveLength(3);
	}

	// ~90 local days for the calendar heatmap, each [date, count]
	expect(data.calendar.length).toBeGreaterThanOrEqual(85);
	expect(data.calendar[0]).toHaveLength(2);
	expect(typeof data.calendar[0][0]).toBe("string");
	expect(typeof data.calendar[0][1]).toBe("number");
});

test("HTTP server serves dashboard, echarts vendor and /api/data with cache", async () => {
	const server = serve(fakeRun, 0);
	const base = `http://127.0.0.1:${server.port}`;
	try {
		const html = await fetch(`${base}/`).then((r) => r.text());
		expect(html).toContain("访问数据看板");
		expect(html).toContain("/vendor/echarts.min.js");

		const vendor = await fetch(`${base}/vendor/echarts.min.js`).then((r) => r.text());
		expect(vendor.length).toBeGreaterThan(1000);
		expect(vendor).toContain("echarts");

		const data = await fetch(`${base}/api/data`).then((r) => r.json());
		expect(data.calendar).toBeDefined();
		expect(data.windows["近7天"].timeseries.labels.length).toBeGreaterThan(0);
		expect(data.cached).toBe(false);

		const cached = await fetch(`${base}/api/data`).then((r) => r.json());
		expect(cached.cached).toBe(true);

		const refreshed = await fetch(`${base}/api/data?refresh=1`).then((r) => r.json());
		expect(refreshed.cached).toBe(false);
	} finally {
		server.stop();
	}
});
