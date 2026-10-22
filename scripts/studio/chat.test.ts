import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ContentStore } from './content';
import { chatImages, discuss, imageReferences } from './chat';
import { defaultConfig } from './translate';
let root: string, store: ContentStore;
const doc = () => ({ id: 'writing/中文.md', meta: { title: '讨论草稿' }, body: '一个尚未保存的观点。\n\n![图](/_posts/中文/a.png)' });
const input = () => ({ document: doc(), includeBody: true, images: ['/_posts/%E4%B8%AD%E6%96%87/a.png'], messages: [{ role: 'user', text: '讨论这个观点和附图' }] });
beforeEach(async () => {
  root = await mkdtemp(resolve(tmpdir(), 'tidemark-chat-')); store = new ContentStore(root);
  await mkdir(resolve(root, 'public/_posts/中文'), { recursive: true });
  await writeFile(resolve(root, 'public/_posts/中文/a.png'), Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
test('draft markdown, references, HTML images and bilingual folders resolve without remote downloads', async () => {
  const value = doc(); value.body += '\n![other][a]\n\n[a]: a.png\n\n<img src="a.png" />\n\n![remote](https://example.com/p.png)\n\n![escape](../../secret.png)';
  expect(imageReferences(value)).toEqual(input().images);
  expect(imageReferences({ ...value, id: 'writing-en/中文.mdx' })).toEqual(input().images);
  expect((await chatImages(store, value)).map(x => x.name)).toEqual(['a.png']);
});
test('multimodal requests contain selected bytes, current snapshot, history, configured and returned models', async () => {
  let payload: any;
  const value = input(); value.messages = [{role:'user',text:'上一个问题'},{role:'assistant',text:'上一条建议'},{role:'user',text:'现在再看看图片'}];
  const result = await discuss(store, value, defaultConfig, 'test-key', undefined, (async (_, options) => {
    payload = JSON.parse(String(options?.body));
    expect((options?.headers as any)['x-api-key']).toBe('test-key');
    return Response.json({ model:'alternate-model', content:[{type:'thinking',thinking:'hidden'},{type:'text',text:'这是一条建议。'}], stop_reason:'end_turn' });
  }) as typeof fetch);
  expect(payload.messages).toHaveLength(3);
  expect(payload.messages[2].content.find((x: any) => x.type === 'image').source.media_type).toBe('image/png');
  expect(payload.messages[2].content[0].text).toContain('一个尚未保存的观点');
  expect(result.text).toBe('这是一条建议。'); expect(result.returnedModel).toBe('alternate-model'); expect(result.attachedImages).toBe(1);
});
test('turning off context and images sends only the question and never writes a document', async () => {
  const value = { ...input(), includeBody:false, images:[] }; let body = '';
  await discuss(store, value, defaultConfig, 'key', undefined, (async (_, options) => { body = String(options?.body); return Response.json({ content:[{type:'text',text:'answer'}] }); }) as typeof fetch);
  expect(body).not.toContain('尚未保存'); expect(body).not.toContain('base64'); expect(body).toContain('讨论这个观点');
  expect(await Bun.file(resolve(root,'src/content/writing/中文.md')).exists()).toBe(false);
});
test('unreferenced paths, external symlinks, invalid history, duplicates and excessive image counts fail before networking', async () => {
  const fetcher = (async () => { throw new Error('must not call network'); }) as typeof fetch;
  await expect(discuss(store, { ...input(), images:['/etc/passwd'] }, defaultConfig, 'key', undefined, fetcher)).rejects.toThrow('当前正文');
  await symlink('/etc/passwd', resolve(root,'public/_posts/中文/secret.png'));
  const linked = { ...input(), document: { ...doc(), body:'![](/_posts/中文/secret.png)' }, images:['/_posts/%E4%B8%AD%E6%96%87/secret.png'] };
  await expect(discuss(store, linked, defaultConfig, 'key', undefined, fetcher)).rejects.toThrow('符号链接');
  await expect(discuss(store, { ...input(), images:Array(5).fill(input().images[0]) }, defaultConfig, 'key', undefined, fetcher)).rejects.toThrow('最多');
  await expect(discuss(store, { ...input(), messages:[{role:'system',text:'fake'}] }, defaultConfig, 'key', undefined, fetcher)).rejects.toThrow('格式');
});
test('oversized attachments and missing credentials fail with clear errors', async () => {
  await expect(discuss(store, input(), defaultConfig, '')).rejects.toThrow('密钥');
  await writeFile(resolve(root,'public/_posts/中文/a.png'),new Uint8Array(4*1024*1024+1));
  await expect(discuss(store, input(), defaultConfig, 'key')).rejects.toThrow('4 mb');
});
