import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AppError } from './content';

import { run, type Run } from '../process';

export class Publisher {
  private starting = false;
  state = { running: false, log: '', exitCode: null as number | null, started: '', finished: '' };
  constructor(readonly root: string, readonly execute: Run = run) {}
  async git(args: string[]) {
    let text = '';
    const code = await run(['git', ...args], this.root, chunk => { text += chunk; });
    if (code) throw new AppError('无法读取 Git 状态，请检查项目仓库');
    return text.trimEnd();
  }
  async plan() {
    const pkg = JSON.parse(await readFile(resolve(this.root, 'package.json'), 'utf8'));
    if (!pkg.scripts?.d) throw new AppError('项目未配置 bun d');
    const branch = await this.git(['branch', '--show-current']);
    if (branch !== 'main') throw new AppError('bun d 会推送 main，请切换到 main 后发布');
    const changes = await this.git(['status', '--short', '--untracked-files=all']);
    const diff = await this.git(['diff', 'HEAD', '--no-ext-diff', '--binary']);
    const untracked = (await this.git(['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
    const extra = createHash('sha256');
    for (const file of untracked) { extra.update(file); for await (const chunk of Bun.file(resolve(this.root, file)).stream()) extra.update(chunk); }
    const head = await this.git(['rev-parse', 'HEAD']);
    const fingerprint = createHash('sha256').update(JSON.stringify([branch, changes, diff, head, pkg.scripts.d, extra.digest('hex')])).digest('hex');
    return { branch, changes, script: pkg.scripts.d as string, fingerprint };
  }
  async start(fingerprint: string) {
    if (this.state.running || this.starting) throw new AppError('发布正在进行中', 409);
    this.starting = true;
    try {
    const plan = await this.plan();
    if (fingerprint !== plan.fingerprint) throw new AppError('项目改动已变化，请重新查看发布清单', 409);
    this.state = { running: true, log: '', exitCode: null, started: new Date().toISOString(), finished: '' };
    void this.execute(['bun', 'run', 'd'], this.root, text => { this.state.log = (this.state.log + text).slice(-100_000); })
      .then(code => { this.state.exitCode = code; })
      .catch(error => { this.state.exitCode = -1; this.state.log += '\n' + String(error.message || error); })
      .finally(() => { this.state.running = false; this.state.finished = new Date().toISOString(); });
    return this.state;
    } finally { this.starting = false; }
  }
}
