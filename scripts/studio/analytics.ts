import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildDashboardData, runStatements, type DashboardData } from '../analytics-server';
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
