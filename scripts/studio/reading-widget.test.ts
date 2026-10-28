import { test, expect } from 'bun:test';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createStudio } from '../studio-server';

test('widget capability exposes only aggregate statistics and cannot access editing or credentials', async () => {
  const root=await mkdtemp(resolve(tmpdir(),'tidemark-widget-api-'));
  const widgetToken='fixture-widget-read-only';
  const app=await createStudio(root,{widgetToken,analyticsRun:async sql=>sql.map(s=>s.includes('viewed_at AS t')?[{t:new Date(Date.now()-1000).toISOString(),v:'never-expose-this-visitor'}]:[{k:'CN',n:1,u:1}])});
  const request=(path:string, method='GET', token=widgetToken)=>app.fetch(new Request('http://127.0.0.1:4322/api/'+path,{method,headers:{'x-tidemark-widget-token':token}}));
  try {
    expect((await request('widget-analytics','GET','')).status).toBe(403);
    expect((await request('widget-analytics','POST')).status).toBe(405);
    for(const path of ['init','document?id=writing/test.md','analytics','settings'])expect((await request(path)).status).toBe(403);
    const response=await request('widget-analytics');expect(response.status).toBe(200);
    const data=await response.json();expect(Object.keys(data.windows)).toHaveLength(6);
    expect(data.windows['近7天'].views).toBe(1);expect(data.windows['近7天'].visitors).toBe(1);
    expect(data.windows['近7天'].posts).toBeUndefined();expect(data.windows['近7天'].country[0].k).toBe('CN');
    expect(JSON.stringify(data)).not.toContain('never-expose-this-visitor');expect(JSON.stringify(data)).not.toContain(widgetToken);
  } finally {app.close();await rm(root,{recursive:true,force:true});}
});

test('Swift widget decodes live API, selects every period and preserves cache on invalid/offline responses',async()=>{
  if(process.platform!=='darwin')return;
  const root=await mkdtemp(resolve(tmpdir(),'tidemark-widget-swift-'));
  let app:Awaited<ReturnType<typeof createStudio>>;
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:req=>app.fetch(req)});
  const credential='fixture-widget-native';
  app=await createStudio(root,{port:server.port,widgetToken:credential,analyticsRun:async sql=>sql.map(s=>s.includes('viewed_at AS t')?[{t:new Date(Date.now()-1000).toISOString(),v:'fixture-visitor'}]:[{k:'CN',n:1,u:1}])});
  try {
    const source=resolve(root,'Check.swift'),bin=resolve(root,'check');
    await writeFile(source,`import Foundation
@main struct Check {
  @MainActor static func main() async throws {
    let endpoint=URL(string:CommandLine.arguments[1])!
    let cache=ReadingCache(file:URL(fileURLWithPath:CommandLine.arguments[2]))
    let data=try await fetchReading(token:CommandLine.arguments[3],endpoint:endpoint)
    let snapshot=try JSONDecoder().decode(ReadingSnapshot.self,from:data)
    assert(snapshot.generatedDate != nil)
    assert(snapshot.windows.count == ReadingPeriod.allCases.count)
    for period in ReadingPeriod.allCases {
      _ = ReadingWidget(period:period).body
      assert(ReadingEntry(date:.now,period:period,snapshot:snapshot,offline:false).window != nil)
    }
    assert(snapshot.windows["近7天"]!.views == 1)
    try cache.write(data)
    assert(cache.read()!.windows["近7天"]!.visitors == 1)
    do { try cache.write(Data("invalid".utf8)); fatalError("invalid data accepted") } catch {}
    assert(cache.read()!.windows["近7天"]!.visitors == 1)
    do { _ = try await fetchReading(token:"wrong",endpoint:endpoint); fatalError("wrong capability accepted") } catch {}
    do { _ = try await fetchReading(token:"fixture",endpoint:URL(string:"http://127.0.0.1:1/")!); fatalError("offline accepted") } catch {}
    assert(cache.read()!.windows["近7天"]!.views == 1)
    assert(rankName(nil,key:"country") == "未知")
    assert(rankName("CN",key:"country").contains("中国"))
    print("widget API, periods, credential scope and offline cache verified")
  }
}`);
    const compile=Bun.spawn(['xcrun','swiftc','-parse-as-library','-swift-version','5','-D','WIDGET_TEST',resolve(import.meta.dir,'macos/ReadingWidget.swift'),source,'-o',bin],{stdout:'pipe',stderr:'pipe'});
    const errors=await new Response(compile.stderr).text();expect(await compile.exited,errors).toBe(0);
    const file=resolve(root,'cache/reading.json');
    const child=Bun.spawn([bin,`http://127.0.0.1:${server.port}/api/widget-analytics`,file,credential],{stdout:'pipe',stderr:'pipe'});
    const stderr=await new Response(child.stderr).text();expect(await child.exited,stderr).toBe(0);
    expect((await stat(file)).mode&0o777).toBe(0o600);
  } finally {app.close();server.stop(true);await rm(root,{recursive:true,force:true});}
},60_000);
