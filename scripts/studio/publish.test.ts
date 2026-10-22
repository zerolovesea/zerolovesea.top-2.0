import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Publisher } from './publish';

test('publish reviews all changes, rejects stale plans, runs bun d once and reports bounded output', async () => {
  const root = await mkdtemp(resolve(tmpdir(),'tidemark-publish-'));
  const git = async (...args: string[]) => { const p = Bun.spawn(['git', ...args], {cwd:root,stdout:'ignore',stderr:'pipe'}); if(await p.exited) throw new Error(await new Response(p.stderr).text()); };
  try {
    await git('init','-b','main'); await writeFile(resolve(root,'package.json'),JSON.stringify({scripts:{d:'echo stub'}}));
    await git('add','package.json'); await git('-c','user.name=test','-c','user.email=test@example.invalid','commit','-m','initial');
    let finish!: (code: number) => void, calls = 0;
    const publisher = new Publisher(root, async (args,cwd,output) => { calls++; expect(args).toEqual(['bun','run','d']); expect(cwd).toBe(root); output('x'.repeat(110_000)); return await new Promise<number>(r => {finish=r;}); });
    await writeFile(resolve(root,'article.md'),'first'); const plan = await publisher.plan(); expect(plan.changes).toContain('article.md');
    await writeFile(resolve(root,'article.md'),'second'); await expect(publisher.start(plan.fingerprint)).rejects.toThrow('变化'); expect(calls).toBe(0);
    const next = await publisher.plan(); await publisher.start(next.fingerprint); expect(publisher.state.running).toBe(true); expect(publisher.state.log.length).toBe(100_000);
    await expect(publisher.start(next.fingerprint)).rejects.toThrow('进行中'); finish(1); await Bun.sleep(5);
    expect(publisher.state.running).toBe(false); expect(publisher.state.exitCode).toBe(1); expect(calls).toBe(1);
    await git('checkout','-b','other'); await expect(publisher.plan()).rejects.toThrow('main');
  } finally { await rm(root,{recursive:true,force:true}); }
});
