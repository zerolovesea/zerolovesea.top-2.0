import { test, expect } from 'bun:test';
import { messagesURL, callModel, protect, chunks, translateDocument, defaultConfig } from './translate';

test('exact configured endpoint is retained and suffix not duplicated', () => {
  expect(messagesURL(defaultConfig.endpoint)).toBe(defaultConfig.endpoint + '/v1/messages');
  expect(messagesURL(defaultConfig.endpoint + '/v1/messages/')).toBe(defaultConfig.endpoint + '/v1/messages');
  expect(() => messagesURL('http://external.example')).toThrow();
});
test('math, code, links and mdx source survive translation unchanged', () => {
  const source = 'import { Sidenote } from "@components/interactive";\n\n中文 $x^{2}$\n\n$$\n\\frac{a}{b}\n$$\n\n```js\nlet x = "$notmath$";\n```\n\n![图](/_posts/a/a.png)\n\n<Sidenote id="1">保持</Sidenote>';
  const protectedBody = protect(source);
  expect(protectedBody.restore(protectedBody.masked.replace('中文', 'English'))).toBe(source.replace('中文', 'English'));
  expect(() => protectedBody.restore('lost tokens')).toThrow('丢失');
  expect(protect('a literal {brace} and $x^2$', false).masked).toContain('{brace}');
});
test('chunks never split immutable tokens', () => {
  const token = 'STUDIO_' + 'a'.repeat(32) + '_0_END';
  const result = chunks('text\n\n' + token + '\n\nother', 20);
  expect(result.some(x => x.includes(token))).toBe(true);
});
test('messages headers, alternate model and text blocks are handled', async () => {
  let captured: RequestInit | undefined;
  const result = await callModel(defaultConfig, 'test-secret', 'ping', undefined, (async (_, init) => {
    captured = init;
    return Response.json({ model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: 'OK' }] });
  }) as typeof fetch);
  expect((captured?.headers as any)['x-api-key']).toBe('test-secret');
  expect(result.text).toBe('OK'); expect(result.returnedModel).toBe('claude-opus-5');
});
test('truncated output is not accepted', async () => {
  await expect(callModel(defaultConfig, 'test-secret', 'ping', undefined, (async () => Response.json({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] })) as typeof fetch)).rejects.toThrow('输出上限');
});
test('translation compiles restored formulas and never uses thinking as article content', async () => {
  const doc = { id: 'writing/math.md', meta: { title: '中文', description: '', pubDate: '2026-10-22' }, body: '中文 $x^{2}$\n\n![图片](/_posts/math/test.png)' };
  const result = await translateDocument(doc, defaultConfig, 'test-secret', new AbortController().signal, () => {}, (async (_, options) => {
    const prompt = JSON.parse(options!.body as string).messages[0].content;
    const text = prompt.startsWith('Translate the values') ? JSON.stringify({ title: 'English', description: '' }) : prompt.split('\n\n').slice(1).join('\n\n').replace('中文', 'English');
    return Response.json({ model: 'alternate', stop_reason: 'end_turn', content: [{ type: 'text', text }] });
  }) as typeof fetch);
  expect(result.document.id).toBe('writing-en/math.md');
  expect(result.document.body).toContain('$x^{2}$');
  expect(result.document.body).toContain('![图片](/_posts/math/test.png)');
});
test('thought translation uses the full translated body as description, preserving line breaks', async () => {
  const doc = { id: 'thought/note.md', meta: { title: '随笔', description: '', category: '随笔', pubDate: '2026-10-23' }, body: '第一行\n第二行\n\n下一段' };
  const body = 'First line\nSecond line\n\nNext paragraph';
  const result = await translateDocument(doc, defaultConfig, 'test-secret', new AbortController().signal, () => {}, (async (_, options) => {
    const prompt = JSON.parse(options!.body as string).messages[0].content;
    return Response.json({ model: 'alternate', stop_reason: 'end_turn', content: [{ type: 'text', text: prompt.startsWith('Translate the values') ? JSON.stringify({ title: 'Note', description: 'short summary', category: 'Notes' }) : body }] });
  }) as typeof fetch);
  expect(result.document.id).toBe('thought-en/note.md');
  expect(result.document.body).toBe(body);
  expect(result.document.meta.description).toBe(body);
});
