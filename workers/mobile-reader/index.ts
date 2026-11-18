const periods: Record<string, number> = {today: 0, day: 1, week: 7, fortnight: 15, month: 30, halfYear: 180};
export default {
  async fetch(request: Request, env: {DB: D1Database}) {
    const reply = (value: unknown, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store'}});
    if(request.method !== 'GET') return reply({error:'Method not allowed'},405);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'week';
    if(url.pathname !== '/api/mobile/overview' || !Object.hasOwn(periods,period)) return reply({error:'Invalid request'},400);
    const now = new Date(), end = now.toISOString();
    const midnight = Math.floor((now.getTime()+28800000)/86400000)*86400000-28800000;
    const since = new Date(period==='today'?midnight:now.getTime()-periods[period]*86400000).toISOString();
    const bucket = periods[period]<=1?3600:period==='week'?21600:86400;
    const where = 'viewed_at >= ?1 AND viewed_at < ?2';
    const queries = [
      `SELECT COUNT(*) views,COUNT(DISTINCT NULLIF(visitor_id,'')) visitors FROM visits WHERE ${where}`,
      `SELECT (CAST(strftime('%s',viewed_at) AS INTEGER)+28800)/${bucket} bucket,COUNT(*) views,COUNT(DISTINCT NULLIF(visitor_id,'')) visitors FROM visits WHERE ${where} GROUP BY 1 ORDER BY 1`,
      ...['country','city','language','slug'].map(key=>`SELECT ${key} name,COUNT(*) count FROM visits WHERE ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`)
    ];
    try {
      const result = await env.DB.batch(queries.map(sql=>env.DB.prepare(sql).bind(since,end)));
      const counts = new Map(result[1].results.map((r:any)=>[Number(r.bucket),r]));
      const series = [];
      for(let n=Math.floor((Date.parse(since)/1000+28800)/bucket);n<=Math.floor((now.getTime()/1000+28800)/bucket);n++){
        const row:any=counts.get(n);
        series.push({time:new Date((n*bucket-28800)*1000).toISOString(),views:row?.views||0,visitors:row?.visitors||0});
      }
      const ranks=(i:number)=>result[i].results.map((r:any)=>({name:r.name||'未知',count:r.count}));
      return reply({generatedAt:end,period,views:Number((result[0].results[0] as any)?.views||0),visitors:Number((result[0].results[0] as any)?.visitors||0),series,countries:ranks(2),cities:ranks(3),languages:ranks(4),posts:ranks(5)});
    } catch { return reply({error:'统计暂时不可用'},503); }
  }
};
