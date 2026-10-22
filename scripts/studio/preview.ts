import { cp, mkdir, readdir, readFile, symlink, rm, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setPriority } from 'node:os';
import { ContentStore, serialize, validateDocument, atomic, AppError, stem } from './content';

export class Preview {
  child: ReturnType<typeof Bun.spawn> | null = null;
  logs = '';
  private queue = Promise.resolve();
  constructor(private store: ContentStore, public port = 4323) {}
  async start() {
    let work = resolve(this.store.state, `preview-${this.port}`);
    await mkdir(resolve(work, 'src'), { recursive: true });
    work = await realpath(work);
    for (const file of ['node_modules', 'public']) {
      await symlink(resolve(this.store.root, file), resolve(work, file)).catch((error: any) => { if (error.code !== 'EEXIST') throw error; });
    }
    for (const file of ['package.json', 'tsconfig.json', 'astro.config.mjs', 'tailwind.config.mjs']) {
      try { await atomic(resolve(work, file), await readFile(resolve(this.store.root, file), 'utf8')); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const entry of await readdir(resolve(this.store.root, 'src'), { withFileTypes: true })) {
      if (entry.name === 'content') continue;
      const target = resolve(work, 'src', entry.name);
      await rm(target, { recursive: true, force: true });
      await cp(resolve(this.store.root, 'src', entry.name), target, { recursive: true });
    }
    await cp(resolve(import.meta.dir, 'component-gallery.astro'), resolve(work, 'src/pages/tidemark-components.astro'));
    if (!this.child || this.child.exitCode !== null) {
      this.logs = '';
      this.child = Bun.spawn(['bun', resolve(this.store.root, 'node_modules/astro/bin/astro.mjs'), '--root', work, 'dev', '--host', '127.0.0.1', '--port', String(this.port)], { cwd: this.store.root, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, STUDIO_LLM_API_KEY: '', ASTRO_DEV_BACKGROUND: '1' } });
      // Keep Astro compilation below foreground apps in the scheduler.
      try { setPriority(this.child.pid, 10); } catch {}
      for (const stream of [this.child.stdout, this.child.stderr]) void (async () => { for await (const bytes of stream as any) this.logs = (this.logs + new TextDecoder().decode(bytes)).slice(-12_000); })();
    }
  }
  prepare(doc: any) {
    const task = this.queue.then(async () => {
      await validateDocument(doc.id, doc.meta, doc.body);
      // Preview content is copied, never symlinked: draft writes cannot reach real collections.
      const target = resolve(this.store.state, `preview-${this.port}/src/content`);
      this.child?.kill();
      if (this.child) await this.child.exited;
      this.child = null;
      await rm(target, { recursive: true, force: true });
      await cp(this.store.content, target, { recursive: true, dereference: false });
      const opposite = resolve(target, doc.id.replace(/\.mdx?$/, doc.id.endsWith('.mdx') ? '.md' : '.mdx'));
      await rm(opposite, { force: true });
      await atomic(resolve(target, doc.id), serialize({ ...doc.meta, slug: '_studio-preview' }, doc.body));
      const collection = doc.id.split('/')[0];
      const otherCollection = collection.endsWith('-en') ? collection.slice(0, -3) : `${collection}-en`;
      for (const extension of ['md', 'mdx']) {
        try {
          const other = await this.store.read(`${otherCollection}/${stem(doc.id)}.${extension}`);
          await atomic(resolve(target, other.id), serialize({ ...other.meta, slug: '_studio-preview' }, other.body));
          break;
        } catch (error) { if (!(error instanceof AppError && error.status === 404)) throw error; }
      }
      await this.start();
      const url = `http://127.0.0.1:${this.port}/${doc.id.split('/')[0].endsWith('-en') ? 'en/' : ''}_studio-preview`;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (this.child && this.child.exitCode !== null) throw new AppError(`预览进程退出：${this.logs}`, 500);
        try {
          const result = await fetch(url, { signal: AbortSignal.timeout(1500) });
          if (result.status === 200) return { url: `${url}?v=${Date.now()}`, logs: this.logs };
          if (result.status === 500) throw new AppError(`Astro 编译失败：${(await result.text()).replace(/<[^>]*>/g, ' ').slice(0, 1000)}\n${this.logs.slice(-6000)}`, 422);
        } catch (error) { if (error instanceof AppError) throw error; }
        await Bun.sleep(300);
      }
      throw new AppError(`预览启动超时：${this.logs}`, 504);
    });
    this.queue = task.then(() => {}, () => {});
    return task;
  }
  components() {
    const task = this.queue.then(async () => {
      if (!this.child || this.child.exitCode !== null) await this.start();
      const url = `http://127.0.0.1:${this.port}/tidemark-components`;
      for (let i = 0; i < 100; i++) {
        if (this.child?.exitCode !== null) throw new AppError(`组件预览退出：${this.logs}`, 500);
        try { const result = await fetch(url, { signal: AbortSignal.timeout(1500) }); if (result.ok) return { url }; if (result.status === 500) throw new AppError(`组件编译失败：${this.logs.slice(-4000)}`, 422); }
        catch (error) { if (error instanceof AppError) throw error; }
        await Bun.sleep(300);
      }
      throw new AppError('组件预览启动超时', 504);
    });
    this.queue = task.then(() => {}, () => {});
    return task;
  }
  pause() {
    const task = this.queue.then(async () => {
      this.stop();
      if (this.child) await this.child.exited;
      this.child = null;
    });
    this.queue = task.then(() => {}, () => {});
    return task;
  }
  stop() { this.child?.kill(); }
}
