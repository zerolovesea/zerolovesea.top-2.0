import { resolve } from 'node:path';
export async function buildClient(root: string) {
  const result = await Bun.build({ entrypoints: [resolve(root, 'scripts/studio/rich-editor.js')], outdir: resolve(root, '.local-studio/client'), target: 'browser', minify: true, naming: { entry: '[name].[ext]', asset: '[name]-[hash].[ext]' } });
  if (!result.success) throw new AggregateError(result.logs, '编辑器编译失败');
}
