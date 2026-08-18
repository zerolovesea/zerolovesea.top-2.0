// Local analytics dashboard for the zerolovesea.top view-counter.
//
// Run:  bun run analytics   (or: bun scripts/analytics-server.ts)
// Open: http://127.0.0.1:8788
//
// Queries the production D1 database through `wrangler d1 execute --json`
// (uses your existing wrangler login, no API token needed). Results are cached
// for 5 minutes server-side; the dashboard has a manual refresh button.
//
// Data pipeline: one hourly time-series query over the last 180 days feeds the
// per-window line charts and the calendar heatmap; four distribution queries
// (country/city/language/posts) cover every window. Time buckets are converted
// to the local timezone of this machine so "今天" aligns with local midnight.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DB_NAME = process.env.D1_DB ?? "zerolovesea-view-counter";
const PORT = Number(process.env.PORT ?? 8788);
const CACHE_TTL_MS = 5 * 60 * 1000;

// Run wrangler from the view-counter dir so the D1 binding resolves.
const WORKER_DIR = fileURLToPath(new URL("../workers/view-counter/", import.meta.url));
const DASHBOARD_HTML = fileURLToPath(new URL("./dashboard.html", import.meta.url));
const ECHARTS_JS = fileURLToPath(new URL("../node_modules/echarts/dist/echarts.min.js", import.meta.url));

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

type Row = Record<string, unknown>;

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function localHourKey(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}`;
}

// ---------------------------------------------------------------------------
// D1 query runner (spawns wrangler, parses its --json output)
// ---------------------------------------------------------------------------

function wranglerCommand(): { bin: string; prefix: string[] } {
	const local = fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url));
	if (existsSync(local)) return { bin: local, prefix: [] };
	return { bin: "bunx", prefix: ["wrangler"] };
}

function runWrangler(args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const { bin, prefix } = wranglerCommand();
		const child = spawn(bin, [...prefix, ...args], {
			cwd: WORKER_DIR,
			env: { ...process.env, CI: "1" },
		});
		let out = "";
		let err = "";
		child.stdout.on("data", (d: Buffer) => (out += d));
		child.stderr.on("data", (d: Buffer) => (err += d));
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve(out);
			else reject(new Error(`wrangler 退出码 ${code}：${err.trim() || out.trim()}`));
		});
	});
}

export async function runStatements(statements: string[]): Promise<Row[][]> {
	const out = await runWrangler([
		"d1",
		"execute",
		DB_NAME,
		"--command",
		statements.join(";\n"),
		"--remote",
		"--json",
	]);
	let parsed: unknown;
	try {
		parsed = JSON.parse(out);
	} catch {
		throw new Error(`无法解析 wrangler 输出：${out.slice(0, 500)}`);
	}
	const list = Array.isArray(parsed) ? parsed : [parsed];
	return list.map((item) => {
		const r = item as { results?: Row[] };
		return Array.isArray(r?.results) ? r.results : [];
	});
}

// ---------------------------------------------------------------------------
// Windows + queries
// ---------------------------------------------------------------------------

export interface WindowDef {
	label: string;
	since: string;
}

export function buildWindows(now = new Date()): WindowDef[] {
	const day = DAY_MS;
	const today = new Date(now);
	today.setHours(0, 0, 0, 0); // local midnight
	return [
		{ label: "近24小时", since: new Date(now.getTime() - day).toISOString() },
		{ label: "今天", since: today.toISOString() },
		{ label: "近7天", since: new Date(now.getTime() - 7 * day).toISOString() },
		{ label: "近15天", since: new Date(now.getTime() - 15 * day).toISOString() },
		{ label: "近30天", since: new Date(now.getTime() - 30 * day).toISOString() },
		{ label: "近半年", since: new Date(now.getTime() - 180 * day).toISOString() },
	];
}

type Granularity = "hour" | "6h" | "day";

const GRANULARITY: Record<string, Granularity> = {
	"近24小时": "hour",
	"今天": "hour",
	"近7天": "6h",
	"近15天": "day",
	"近30天": "day",
	"近半年": "day",
};

const METRICS: { key: "country" | "city" | "language" | "posts"; stmt: (since: string) => string }[] = [
	{
		key: "country",
		stmt: (s) =>
			`SELECT country AS k, COUNT(*) AS n FROM visits WHERE viewed_at >= '${s}' GROUP BY country ORDER BY n DESC LIMIT 15`,
	},
	{
		key: "city",
		stmt: (s) =>
			`SELECT city AS k, COUNT(*) AS n FROM visits WHERE viewed_at >= '${s}' AND city IS NOT NULL GROUP BY city ORDER BY n DESC LIMIT 15`,
	},
	{
		key: "language",
		stmt: (s) =>
			`SELECT language AS k, COUNT(*) AS n FROM visits WHERE viewed_at >= '${s}' AND language IS NOT NULL GROUP BY language ORDER BY n DESC LIMIT 15`,
	},
	{
		key: "posts",
		stmt: (s) =>
			`SELECT slug AS k, COUNT(*) AS n FROM visits WHERE viewed_at >= '${s}' GROUP BY slug ORDER BY n DESC LIMIT 20`,
	},
];

// One row per visit over the whole range; everything time-based (line charts,
// calendar, per-window visits/visitors) derives from it in JS.
const VISIT_ROWS_STMT = (since: string) =>
	`SELECT viewed_at AS t, visitor_id AS v FROM visits WHERE viewed_at >= '${since}'`;

// ---------------------------------------------------------------------------
// Time-series assembly (local timezone buckets + zero-fill)
// ---------------------------------------------------------------------------

export interface Timeseries {
	labels: string[];
	values: number[];
	uniques: number[];
}

export interface DashboardData {
	generatedAt: string;
	calendar: [string, number][];
	windows: Record<
		string,
		{
			visits: number;
			visitors: number;
			timeseries: Timeseries;
			country: Row[];
			city: Row[];
			language: Row[];
			posts: Row[];
		}
	>;
}

function hourLabel(d: Date): string {
	return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:00`;
}

function dayLabel(d: Date): string {
	return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildSeries(
	hourCounts: Map<string, number>,
	hourUniques: Map<string, Set<string>>,
	windowStart: Date,
	now: Date,
	granularity: Granularity,
): Timeseries {
	const start = new Date(windowStart);
	start.setMinutes(0, 0, 0);
	if (granularity === "6h") start.setHours(Math.floor(start.getHours() / 6) * 6);
	if (granularity === "day") start.setHours(0, 0, 0, 0);

	const hours: { d: Date; n: number; u: number }[] = [];
	for (let d = new Date(start); d.getTime() <= now.getTime(); d = new Date(d.getTime() + HOUR_MS)) {
		const key = localHourKey(d);
		hours.push({ d: new Date(d), n: hourCounts.get(key) ?? 0, u: hourUniques.get(key)?.size ?? 0 });
	}

	if (granularity === "hour") {
		return {
			labels: hours.map((h) => hourLabel(h.d)),
			values: hours.map((h) => h.n),
			uniques: hours.map((h) => h.u),
		};
	}

	const group = granularity === "6h" ? 6 : 24;
	const labels: string[] = [];
	const values: number[] = [];
	const uniques: number[] = [];
	for (let i = 0; i < hours.length; i += group) {
		const chunk = hours.slice(i, i + group);
		labels.push(granularity === "6h" ? hourLabel(chunk[0].d) : dayLabel(chunk[0].d));
		values.push(chunk.reduce((sum, h) => sum + h.n, 0));
		// exact distinct visitors across the whole bucket (union of hour sets)
		const seen = new Set<string>();
		for (const h of chunk) for (const id of hourUniques.get(localHourKey(h.d)) ?? []) seen.add(id);
		uniques.push(seen.size);
	}
	return { labels, values, uniques };
}

function buildCalendar(hourCounts: Map<string, number>, now: Date, days = 90): [string, number][] {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - (days - 1));
	const out: [string, number][] = [];
	for (let d = new Date(start); d.getTime() <= now.getTime(); d = new Date(d.getTime() + DAY_MS)) {
		const key = localDateKey(d);
		let sum = 0;
		for (let h = 0; h < 24; h++) sum += hourCounts.get(`${key}T${pad2(h)}`) ?? 0;
		out.push([key, sum]);
	}
	return out;
}

function localDateKey(d: Date): string {
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export async function buildDashboardData(
	run: (statements: string[]) => Promise<Row[][]>,
	now = new Date(),
): Promise<DashboardData> {
	const windows = buildWindows(now);
	const since180 = new Date(now.getTime() - 180 * DAY_MS).toISOString();

	// Per-visit rows over 180 days; exact counts and uniques derive from them.
	const [[rows]] = await Promise.all([run([VISIT_ROWS_STMT(since180)])]);
	const visits: { time: Date; vid: string | null }[] = [];
	for (const r of rows ?? []) {
		const time = new Date(String(r.t));
		if (Number.isNaN(time.getTime())) continue;
		visits.push({ time, vid: typeof r.v === "string" && r.v ? r.v : null });
	}

	const hourCounts = new Map<string, number>();
	const hourUniques = new Map<string, Set<string>>();
	for (const v of visits) {
		const key = localHourKey(v.time);
		hourCounts.set(key, (hourCounts.get(key) ?? 0) + 1);
		if (v.vid) {
			let set = hourUniques.get(key);
			if (!set) {
				set = new Set<string>();
				hourUniques.set(key, set);
			}
			set.add(v.vid);
		}
	}

	const perMetric = await Promise.all(
		METRICS.map(async (m) => ({
			key: m.key,
			rows: await run(windows.map((w) => m.stmt(w.since))),
		})),
	);

	const out = {} as DashboardData["windows"];
	windows.forEach((w, i) => {
		const sinceMs = new Date(w.since).getTime();
		const inWindow = visits.filter((v) => v.time.getTime() >= sinceMs);
		const visitors = new Set(inWindow.map((v) => v.vid).filter(Boolean)).size;
		const series = buildSeries(hourCounts, hourUniques, new Date(w.since), now, GRANULARITY[w.label] ?? "day");
		const entry = {
			visits: inWindow.length,
			visitors,
			timeseries: series,
			country: [],
			city: [],
			language: [],
			posts: [],
		} as DashboardData["windows"][string];
		for (const m of perMetric) {
			(entry as Record<string, unknown>)[m.key] = m.rows[i] ?? [];
		}
		out[w.label] = entry;
	});

	return {
		generatedAt: now.toISOString(),
		windows: out,
		calendar: buildCalendar(hourCounts, now, 90),
	};
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

export function serve(
	run: (statements: string[]) => Promise<Row[][]>,
	port = PORT,
) {
	let cache: { at: number; data: DashboardData } | null = null;
	let html: string | null = null;
	let echartsJs: string | null = null;

	const server = Bun.serve({
		hostname: "127.0.0.1",
		port,
		async fetch(req) {
			const url = new URL(req.url);

			if (url.pathname === "/api/data") {
				const refresh = url.searchParams.get("refresh") === "1";
				if (cache && !refresh && Date.now() - cache.at < CACHE_TTL_MS) {
					return Response.json({ ...cache.data, cached: true });
				}
				try {
					const data = await buildDashboardData(run);
					cache = { at: Date.now(), data };
					return Response.json({ ...data, cached: false });
				} catch (e) {
					return Response.json(
						{ error: e instanceof Error ? e.message : String(e) },
						{ status: 500 },
					);
				}
			}

			if (url.pathname === "/vendor/echarts.min.js") {
				echartsJs ??= await Bun.file(ECHARTS_JS).text();
				return new Response(echartsJs, {
					headers: { "content-type": "application/javascript; charset=utf-8" },
				});
			}

			if (url.pathname === "/" || url.pathname === "/index.html") {
				html ??= await Bun.file(DASHBOARD_HTML).text();
				return new Response(html, {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}

			return new Response("Not Found", { status: 404 });
		},
	});

	console.log(`访问数据看板: http://127.0.0.1:${server.port}`);
	return server;
}

if (import.meta.main) {
	serve(runStatements, PORT);
}
