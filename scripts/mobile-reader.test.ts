import {test,expect} from 'bun:test';
import {Database} from 'bun:sqlite';
import worker from '../workers/mobile-reader';
test('mobile API allows anonymous read, rejects mutation, aggregates real rows and fills gaps',async()=>{
 const db=new Database(':memory:');
 db.run('CREATE TABLE visits(viewed_at TEXT,visitor_id TEXT,country TEXT,city TEXT,language TEXT,slug TEXT)');
 const now=new Date().toISOString();
 for(const id of ['one','one','two']) db.run('INSERT INTO visits VALUES (?,?,?,?,?,?)',[now,id,'CN','Nanjing','zh-CN','post']);
 const env:any={DB:{
  prepare:(sql:string)=>({bind:(...args:any[])=>({sql,args})}),
  batch:async(statements:any[])=>statements.map(s=>({results:db.query(s.sql).all(...s.args)}))
 }};
 const request=(path='/api/mobile/overview?period=week',method='GET')=>worker.fetch(new Request('https://example.com'+path,{method}),env);
 try {
  expect((await request()).status).toBe(200);
  expect((await request(undefined,'POST')).status).toBe(405);
  expect((await request('/api/mobile/overview?period=invalid')).status).toBe(400);
  expect((await request('/api/mobile/overview?period=constructor')).status).toBe(400);
  const result=await (await request()).json();
  expect(result.views).toBe(3);expect(result.visitors).toBe(2);
  expect(result.series.reduce((n:number,r:any)=>n+r.views,0)).toBe(3);
  expect(result.series.some((r:any)=>r.views===0)).toBe(true);
  expect(result.countries[0]).toEqual({name:'CN',count:3});
  expect(JSON.stringify(result)).not.toContain('visitor_id');
  expect(JSON.stringify(result)).not.toContain('test-only-token');
 }finally {db.close();}
});
