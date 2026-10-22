import { createProcessor } from '@mdx-js/mdx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { AppError, validId } from './content';

export function prepareRich(id: string, body: string) {
  validId(id);
  if (typeof body !== 'string' || body.length > 2_000_000) throw new AppError('正文最多 2 mb');
  let tree: any;
  try { tree = id.endsWith('.mdx') ? createProcessor({ remarkPlugins: [remarkGfm, remarkMath] }).parse(body) : unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(body); }
  catch { throw new AppError('MDX 语法尚未完成，请修正源码后再切换富文本'); }
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const fragments: { token: string; raw: string; kind: string; inline: boolean; start: number; end: number }[] = [];
  function walk(node: any) {
    if (['mdxjsEsm','mdxJsxFlowElement','mdxFlowExpression','mdxJsxTextElement','mdxTextExpression','math','inlineMath','html','footnoteDefinition','footnoteReference','definition','linkReference','imageReference'].includes(node.type)) {
      const start = node.position.start.offset, end = node.position.end.offset;
      fragments.push({ token: `tidemark${nonce}x${fragments.length}`, raw: body.slice(start, end), kind: node.type, inline: ['inlineMath','mdxJsxTextElement','mdxTextExpression','footnoteReference','linkReference','imageReference'].includes(node.type), start, end });
      return;
    }
    node.children?.forEach(walk);
  }
  walk(tree);
  let markdown = body;
  for (const part of [...fragments].reverse()) markdown = markdown.slice(0, part.start) + (part.inline ? part.token : `\`\`\`${part.token}\n${part.token}\n\`\`\``) + markdown.slice(part.end);
  return { markdown, fragments };
}
