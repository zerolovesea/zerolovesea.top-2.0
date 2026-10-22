import { test, expect } from 'bun:test';
import { prepareRich } from './rich';
import { renderReply } from './markdown';

test('AI replies render markdown, tables, code and math without executable HTML or remote images', async () => {
  const html = await renderReply('# 标题\n\n**粗体**\n\n- 一\n- 二\n\n```js\nconst x = "<script>"\n```\n\n|a|b|\n|-|-|\n|1|2|\n\n$x^2$\n\n<script>alert(1)</script>\n\n[坏链接](javascript:alert%281%29)\n\n![追踪](https://example.com/pixel.gif)\n\n![图][ref]\n\n[ref]: https://example.com/tracker.png');
  expect(html).toContain('<h1>标题</h1>'); expect(html).toContain('<strong>粗体</strong>'); expect(html).toContain('<table>'); expect(html).toContain('katex');
  expect(html).not.toContain('<script>'); expect(html).not.toContain('href="javascript:'); expect(html).not.toContain('<img'); expect(html).toContain('&#x3C;script>');
});
test('rich preparation protects exact MDX, math and imports without parsing code as components', () => {
  const raw = 'import { Highlight } from "@components/interactive";\n\n# 标题\n\n这里是 $x^2$ 和 <Highlight>高亮</Highlight>。\n\n<DecisionForm />\n\n$$\n\\frac{1}{2}\n$$\n\n```jsx\n<Example />\n```';
  const prepared = prepareRich('writing/test.mdx', raw);
  expect(prepared.fragments.map(x => x.kind)).toEqual(['mdxjsEsm','inlineMath','mdxJsxTextElement','mdxJsxFlowElement','math']);
  expect(prepared.markdown).toContain('<Example />');
  let restored = prepared.markdown;
  for (const p of prepared.fragments) restored = restored.replace(p.inline ? p.token : `\`\`\`${p.token}\n${p.token}\n\`\`\``, () => p.raw);
  expect(restored).toBe(raw);
  expect(() => prepareRich('writing/test.mdx', '<Missing')).toThrow('MDX');
});

test('rich markdown serializer retains protected source while editing ordinary text', async () => {
  const { parsePrepared, manager } = await import('./rich-editor.js');
  const raw = 'import { Highlight } from "@components/interactive";\n\n原文 **加粗** 与 $x^2$。\n\n<Highlight color="pink">内容</Highlight>\n\n$$\nE=mc^2\n$$';
  const prepared = prepareRich('writing/a.mdx', raw);
  const json = parsePrepared(prepared);
  const output = manager.serialize(json);
  for (const part of prepared.fragments) expect(output).toContain(part.raw);
  expect(output).toContain('**加粗**'); expect(output).not.toContain('tidemark');
});
