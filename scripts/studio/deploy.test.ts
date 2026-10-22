import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { deploy } from '../deploy';
import { run } from '../process';
let root: string, local: string, other: string, remote: string;
async function git(cwd: string, ...args: string[]) {
  let text=''; const code=await run(['git',...args],cwd,chunk=>{text+=chunk;});
  if(code)throw new Error(text);return text.trimEnd();
}
beforeEach(async()=>{
  root=await mkdtemp(resolve(tmpdir(),'tidemark-deploy-'));local=resolve(root,'local');other=resolve(root,'other');remote=resolve(root,'remote.git');
  await mkdir(local);await git(root,'init','--bare','--initial-branch=main',remote);await git(local,'init','-b','main');
  await git(local,'config','user.name','test');await git(local,'config','user.email','test@example.invalid');
  await writeFile(resolve(local,'article.md'),'original\n');await git(local,'add','-A');await git(local,'commit','-m','seed');await git(local,'remote','add','origin',remote);await git(local,'push','-u','origin','main');
  await git(root,'clone',remote,other);await git(other,'config','user.name','test');await git(other,'config','user.email','test@example.invalid');
});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
async function remoteChange(name: string, body: string) {
  await writeFile(resolve(other,name),body);await git(other,'add','-A');await git(other,'commit','-m','remote change');await git(other,'push','origin','main');
}
function runner(onBuild:()=>Promise<void>=async()=>{}, beforePush:()=>Promise<void>=async()=>{}) {
  const calls:string[]=[];
  const execute:typeof run=async(args,cwd,output)=>{
    calls.push(args.join(' '));
    if(args[0]==='bun'){await onBuild();return 0;}
    if(args[0]==='bunx')return 0;
    if(args[0]==='git'&&args[1]==='push')await beforePush();
    return run(args,cwd,output);
  };
  return {execute,calls};
}
test('divergent remote changes merge safely and the final build includes both sides',async()=>{
  await remoteChange('remote.md','from remote');await writeFile(resolve(local,'local.md'),'local work');
  const builds:string[][]=[];const {execute,calls}=runner(async()=>{
    const remoteFile=await Bun.file(resolve(local,'remote.md')).exists();builds.push([await readFile(resolve(local,'local.md'),'utf8'),remoteFile?'remote present':'remote absent']);
  });
  await deploy(local,execute,()=>{});
  expect(builds).toEqual([['local work','remote absent'],['local work','remote present']]);
  expect(await git(local,'status','--porcelain')).toBe('');expect(await git(local,'rev-parse','HEAD')).toBe(await git(other,'ls-remote','origin','refs/heads/main').then(x=>x.split('\t')[0]));
  expect(calls.at(-1)).toBe('bunx wrangler deploy --name sanju');expect(calls.some(x=>x.includes('--force'))).toBe(false);
});
test('an edit followed by a revert still syncs its commit history without a file conflict',async()=>{
  await remoteChange('article.md','temporary');await remoteChange('article.md','original\n');
  await writeFile(resolve(local,'local.md'),'already committed');await git(local,'add','-A');await git(local,'commit','-m','local change');
  const {execute,calls}=runner();await deploy(local,execute,()=>{});
  expect(await readFile(resolve(local,'article.md'),'utf8')).toBe('original\n');
  expect(calls.filter(x=>x==='bun run build')).toHaveLength(1);expect(calls.at(-1)).toContain('wrangler deploy');
});
test('real conflicts abort the merge, preserve the local commit and skip push/deployment',async()=>{
  await remoteChange('article.md','remote version\n');await writeFile(resolve(local,'article.md'),'local version\n');
  const {execute,calls}=runner();await expect(deploy(local,execute,()=>{})).rejects.toThrow('article.md');
  expect(await readFile(resolve(local,'article.md'),'utf8')).toBe('local version\n');expect(await git(local,'status','--porcelain')).toBe('');
  expect(await Bun.file(resolve(local,'.git/MERGE_HEAD')).exists()).toBe(false);
  expect(calls.some(x=>x.startsWith('git push')||x.startsWith('bunx'))).toBe(false);
});
test('a remote update during publication rejects a normal push and never deploys',async()=>{
  await writeFile(resolve(local,'local.md'),'local work');
  const {execute,calls}=runner(async()=>{},async()=>{await remoteChange('concurrent.md','new remote work');});
  await expect(deploy(local,execute,()=>{})).rejects.toThrow('尚未部署');expect(calls.some(x=>x.startsWith('bunx'))).toBe(false);
  expect(await readFile(resolve(local,'local.md'),'utf8')).toBe('local work');expect(await git(local,'status','--porcelain')).toBe('');
});
