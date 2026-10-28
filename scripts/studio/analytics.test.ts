import { test, expect } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { analyticsReader } from './analytics';
import { createStudio } from '../studio-server';

const fakeRun = async (statements: string[]) => statements.map(sql => sql.includes('viewed_at AS t')
  ? [{ t: new Date().toISOString(), v: 'private-visitor-id' }]
  : [{ k: 'CN', n: 1, u: 1 }]);

test('analytics shares concurrent reads, persists cache, refreshes and keeps stale data on outage', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-analytics-'));
  let calls = 0;
  let fail = false;
  const run = async (sql: string[]) => { calls++; await Bun.sleep(5); if(fail)throw new Error('offline');return fakeRun(sql); };
  try {
    const read = analyticsReader(root, run);
    const [a,b] = await Promise.all([read(),read(true)]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain('private-visitor-id');
    await read();expect(calls).toBe(1);
    const restored = analyticsReader(root, run);
    expect((await restored()).cached).toBe(true);expect(calls).toBe(1);
    await restored(true);expect(calls).toBe(2);
    fail = true;
    const stale = await restored(true);
    expect(stale.stale).toBe(true);expect(stale.error).toContain('重试');expect(stale.windows).toEqual(a.windows);
    const empty = analyticsReader(resolve(root,'empty'), run);
    await expect(empty()).rejects.toMatchObject({status:503});
    fail=false;
    expect((await empty()).cached).toBe(false);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('studio analytics is authenticated and manual refresh bypasses cache', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-analytics-api-'));
  let calls=0;
  await mkdir(resolve(root,'src/content/writing'),{recursive:true});
  await writeFile(resolve(root,'src/content/writing/多端同步与UI设计：言录.md'),'---\ntitle: 原文标题\ndescription: 简介\npubDate: 2026-10-28\n---\n正文');
  const app = await createStudio(root,{analyticsRun:async sql=>{calls++;return fakeRun(sql);}});
  const get = (query='', token=app.token) => app.fetch(new Request('http://127.0.0.1:4322/api/analytics'+query,{headers:{'x-studio-token':token}}));
  try {
    expect((await get('','wrong')).status).toBe(403);expect(calls).toBe(0);
    const init=await app.fetch(new Request('http://127.0.0.1:4322/api/init',{headers:{'x-studio-token':app.token}}));
    expect((await init.json()).documents[0].slug).toBe('多端同步与ui设计言录');
    const result = await get();expect(result.status).toBe(200);
    expect((await result.json()).windows['近7天'].country[0].k).toBe('CN');
    await get();expect(calls).toBe(1);
    await get('?refresh=1');expect(calls).toBe(2);
  } finally { app.close();await rm(root,{recursive:true,force:true}); }
});

test('overview renders truthful loading/empty/error states, safe rankings and PV/UV series', async () => {
  const source=await Bun.file(resolve(import.meta.dir,'app.js')).text();
  const functions=source.slice(source.indexOf('async function loadAnalytics('),source.indexOf('function renderList('));
  const data=await (await import('../analytics-server')).buildDashboardData(fakeRun);
  const state:any={analyticsData:null,analyticsLoading:true,analyticsError:'',analyticsWindow:'近7天',analyticsMetric:'views',documents:[],
    head:(title:string)=>title,singlePicker:()=>'',icon:()=>'',isEnglish:(id:string)=>id.startsWith('writing-en/'),stemOf:(id:string)=>id.split('/')[1].replace(/\.mdx?$/,''),Intl,Date};
  runInNewContext(source.split('\n').find(s=>s.startsWith('const escape ='))+'\n'+functions+'\nthis.home=renderHome;this.trend=renderTrend;',state);
  expect(state.home()).toContain('正在读取');
  state.analyticsLoading=false;state.analyticsError='offline';expect(state.home()).toContain('offline');
  state.analyticsData=data;state.analyticsError='';
  const w=data.windows['近7天'];w.posts=[{k:'<img src=x onerror=alert(1)>',n:1,u:1}];
  state.documents=[{id:'writing/多端同步与ui设计：言录.md',slug:'多端同步与ui设计言录',meta:{title:'多端同步与 UI 设计：言录'}}];
  w.posts.push({k:'多端同步与ui设计言录',n:1,u:1});
  const html=state.home();expect(html).toContain('多端同步与 UI 设计：言录');expect(html).toContain('独立访客');expect(html).toContain('国家 / 地区');expect(html).toContain('中国');expect(html).toContain('访客语言');expect(html).toContain('&lt;img');expect(html).not.toContain('<img');
  const series={labels:['10-28 08:00','10-28 09:00'],values:[8,4],uniques:[3,2]};
  expect(state.trend(series)).toContain('08:00 · 8');state.analyticsMetric='visitors';expect(state.trend(series)).toContain('08:00 · 3');
  expect(state.trend({labels:['zero'],values:[0],uniques:[0]})).not.toMatch(/NaN|Infinity/);
  state.analyticsError='更新失败';expect(state.home()).toContain('上次成功');
  w.posts=[];expect(state.home()).toContain('此时间段暂无数据');
});
