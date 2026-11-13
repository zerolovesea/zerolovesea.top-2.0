import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildDashboardData, buildWindows, runStatements, type DashboardData } from '../analytics-server';
import { atomic, AppError } from './content';

// Share a single query across windows; residency never starts a polling timer.
export function analyticsReader(state: string, run = runStatements) {
  let cache: DashboardData | null = null;
  let pending: Promise<any> | null = null;
  const path = resolve(state, 'analytics.json');
  return async (refresh = false) => {
    if (pending) return pending;
    pending = (async () => {
      if (!cache) {
        try {
          const saved = JSON.parse(await readFile(path, 'utf8'));
          if (saved.windows && Number.isFinite(Date.parse(saved.generatedAt))) cache = saved;
        } catch (error: any) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
      }
      if (cache && !refresh && Date.now() - Date.parse(cache.generatedAt) < 15 * 60_000) return { ...cache, cached: true };
      try {
        const data = await buildDashboardData(run);
        await atomic(path, JSON.stringify(data));
        cache = data;
        return { ...data, cached: false };
      } catch {
        const error = '无法更新线上统计，请检查网络及本机 wrangler 登录后重试。';
        if (cache) return { ...cache, cached: true, stale: true, error };
        throw new AppError(error, 503);
      }
    })();
    try { return await pending; } finally { pending = null; }
  };
}

export async function readVisitDetails(window: string | null, page: number, run = runStatements, at: string | null = null) {
  const now = at ? new Date(at) : new Date();
  if (!Number.isFinite(now.getTime())) throw new AppError('无效的统计时间', 400);
  const period = buildWindows(now).find(w => w.label === window);
  if (!period || !Number.isSafeInteger(page) || page < 1 || page > 10_000) throw new AppError('无效的时间段或页码', 400);
  const size = 20;
  // Older databases have no device/IP columns. Project the response explicitly so visitor IDs stay private.
  const [rows = []] = await run([
    `SELECT * FROM visits WHERE viewed_at >= '${period.since}' AND viewed_at < '${now.toISOString()}' ORDER BY viewed_at DESC, id DESC LIMIT ${size + 1} OFFSET ${(page - 1) * size}`,
  ]).catch(() => { throw new AppError('无法读取访问明细，请稍后重试。', 503); });
  return {
    more: page < 10_000 && rows.length > size,
    rows: rows.slice(0, size).map(r => ({
      time: r.viewed_at, country: r.country, city: r.city, language: r.language,
      slug: r.slug, device: r.device ?? null, ipPrefix: r.ip_prefix ?? null,
    })),
  };
}
