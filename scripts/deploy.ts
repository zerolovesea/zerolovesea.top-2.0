import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { run as runCommand } from './process';

export async function deploy(root: string, execute = runCommand, output = (text: string) => { process.stdout.write(text); }) {
  const read = async (...args: string[]) => {
    let text = '';
    const code = await execute(['git', ...args], root, chunk => { text += chunk; });
    if (code) throw new Error(`Git 检查失败：${text.trim()}`);
    return text.trimEnd();
  };
  const step = async (label: string, args: string[]) => {
    output(`\n${label}\n`);
    if (await execute(args, root, output)) throw new Error(`${label}失败，请检查上方输出。`);
  };
  if (await read('branch', '--show-current') !== 'main') throw new Error('请切换到 main 后发布');
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']) {
    if (existsSync(resolve(root, await read('rev-parse', '--git-path', marker)))) throw new Error('Git 有尚未完成的合并或变基，请先处理后再发布');
  }
  if (await read('diff', '--name-only', '--diff-filter=U')) throw new Error('Git 存在未处理的冲突，请先处理后再发布');
  await step('获取远程更新', ['git', 'fetch', 'origin', 'main']);
  let builtHead: string | undefined;
  if (await read('status', '--porcelain', '--untracked-files=all')) {
    await step('检查本地构建', ['bun', 'run', 'build']);
    await step('暂存本地改动', ['git', 'add', '-A']);
    const changed = await execute(['git', 'diff', '--cached', '--quiet'], root, output);
    if (changed === 1) await step('保存本地提交', ['git', 'commit', '-m', 'deploy: update site']);
    else if (changed !== 0) throw new Error('无法检查暂存改动，发布已停止');
    builtHead = await read('rev-parse', 'HEAD');
  }
  if (await read('status', '--porcelain', '--untracked-files=all')) throw new Error('项目在发布过程中出现新改动，请保存完成后重新发布');
  output('\n合并远程更新\n');
  if (await execute(['git', 'merge', '--no-edit', 'origin/main'], root, output)) {
    const conflicts = await read('diff', '--name-only', '--diff-filter=U');
    if (existsSync(resolve(root, await read('rev-parse', '--git-path', 'MERGE_HEAD')))) {
      if (await execute(['git', 'merge', '--abort'], root, output)) throw new Error('无法撤回合并，请先检查 Git 状态，本次没有推送或部署');
    }
    throw new Error(conflicts ? `远程改动与以下文件有冲突，已撤回本次合并，本地提交完整保留：\n${conflicts}\n请处理这些文件后重新发布。` : '无法合并远程更新，本次没有推送或部署，请检查上方 Git 输出。');
  }
  if (builtHead !== await read('rev-parse', 'HEAD')) await step('构建同步后的网站', ['bun', 'run', 'build']);
  if (await read('status', '--porcelain', '--untracked-files=all')) throw new Error('项目在发布过程中出现新改动，请保存完成后重新发布');
  output('\n推送到远程 main\n');
  if (await execute(['git', 'push', 'origin', 'main'], root, output)) throw new Error('推送未成功，尚未部署。请检查上方输出；若远程又有新提交，重新发布会再次同步。');
  await step('部署网站', ['bunx', 'wrangler', 'deploy', '--name', 'sanju']);
}

if (import.meta.main) {
  try { await deploy(resolve(import.meta.dir, '..')); }
  catch (error) { console.error('\n' + (error instanceof Error ? error.message : String(error))); process.exitCode = 1; }
}
