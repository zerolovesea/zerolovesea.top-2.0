import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

test('widget URLs accept only new thought/writing and the status icon contains visible alpha', async () => {
  if (process.platform !== 'darwin') return;
  const directory = await mkdtemp(resolve(tmpdir(), 'tidemark-native-test-'));
  try {
    const source = resolve(directory, 'Check.swift'), executable = resolve(directory, 'check');
    await writeFile(source, `import AppKit
@main struct Check {
  static func main() {
    for kind in QuickWriteKind.allCases { assert(QuickWriteKind(url: kind.url) == kind) }
    for value in ["https://new/thought", "tidemark://delete/thought", "tidemark://new/unknown", "tidemark://new/thought/extra", "tidemark://user@new/thought", "tidemark://new:80/thought", "tidemark://new/thought?body=overwrite", "tidemark://new/writing#script"] {
      assert(QuickWriteKind(url: URL(string: value)!) == nil, value)
    }
    let bitmap = NSBitmapImageRep(data: try! Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))!
    var visible = 0
    for y in 0..<bitmap.pixelsHigh { for x in 0..<bitmap.pixelsWide { if bitmap.colorAt(x: x, y: y)!.alphaComponent > 0.1 { visible += 1 } } }
    assert(visible > bitmap.pixelsWide * bitmap.pixelsHigh / 20)
    assert(bitmap.pixelsWide < 120 && bitmap.pixelsHigh < 120)
    print("quick-write URLs and exported icon verified")
  }
}`);
    const icon = resolve(directory, 'StatusIcon.png');
    const generate = Bun.spawn(['xcrun', 'swift', resolve(import.meta.dir, 'macos/StatusIcon.swift'), resolve(import.meta.dir, '../../public/android-icon-192x192.png'), icon], {stdout:'pipe',stderr:'pipe'});
    expect(await generate.exited).toBe(0);
    const compile = Bun.spawn(['xcrun','swiftc','-parse-as-library',resolve(import.meta.dir,'macos/QuickWrite.swift'),source,'-o',executable],{stdout:'pipe',stderr:'pipe'});
    const errors = await new Response(compile.stderr).text(); expect(await compile.exited, errors).toBe(0);
    const check = Bun.spawn([executable, icon],{stdout:'pipe',stderr:'pipe'}); expect(await check.exited).toBe(0);
  } finally { await rm(directory,{recursive:true,force:true}); }
},30_000);

test('quick creation backs up the previous edited document and stops if backup fails', async () => {
  const { runInNewContext } = await import('node:vm');
  const script = await Bun.file(resolve(import.meta.dir,'app.js')).text();
  const preserve = script.slice(script.indexOf('async function preserve()'),script.indexOf('async function openDoc('));
  const chooseNew = script.slice(script.indexOf('async function chooseNew('),script.indexOf('const navs='));
  const original = {id:'writing/original.md',meta:{title:'未完成的文章'},body:'正在编辑的内容'};
  const copies: any[] = [];
  const state: any = {doc:structuredClone(original),dirty:true,chatController:null,chatOpen:false,translationController:null,translation:null,previewURL:'',drafts:[],
    newDoc:(kind: string)=>({id:kind+'/new.md',body:''}),go:()=>{},
    api:async(route: string,value?: any)=>{if(route==='draft')copies.push(structuredClone(value));return {drafts:[]};},
  };
  runInNewContext(preserve+chooseNew+'\nglobalThis.create = chooseNew;',state);
  await state.create('thought'); expect(copies).toEqual([original]); expect(state.doc.id).toBe('thought/new.md');
  state.doc=structuredClone(original);state.dirty=true;state.api=async()=>{throw new Error('backup failed');};
  await expect(state.create('writing')).rejects.toThrow('backup failed');expect(state.doc).toEqual(original);expect(state.dirty).toBe(true);
});
