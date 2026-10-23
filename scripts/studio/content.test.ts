import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { ContentStore, parseDocument, serialize, validateDocument, insertComponent, imageType, safePath } from './content';
import { createStudio } from '../studio-server';

let root: string, store: ContentStore;
beforeEach(async () => { root = await mkdtemp(resolve(tmpdir(), 'studio-test-')); await mkdir(resolve(root, 'src/content/writing'), { recursive: true }); await mkdir(resolve(root, 'public'), { recursive: true }); store = new ContentStore(root); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const sample = () => ({ id: 'writing/中文 filename.md', revision: null, meta: { title: '中文标题', description: '', pubDate: '2026-10-22 12:00:00', custom: { keep: true } }, body: 'Hello $x^2$.\n\n$$\n\\frac{1}{2}\n$$\n' });

test('YAML round trip preserves custom fields, math source and leading line breaks', () => {
  const doc = sample();
  for (const body of [doc.body, '\n\n' + doc.body]) expect(parseDocument(serialize(doc.meta, body))).toEqual({ meta: doc.meta, body });
});
test('Chinese and English thoughts synchronize multiline body into description on save and draft', async () => {
  for (const collection of ['thought', 'thought-en']) {
    const doc = { ...sample(), id: `${collection}/note.md`, meta: { ...sample().meta, category: '随笔', description: 'outdated summary' }, body: '第一行\n第二行\n\n下一段\n' };
    await store.draft(structuredClone(doc));
    const draft = (await store.drafts()).find(item => item.id === doc.id);
    expect(draft.meta.description).toBe(doc.body);
    const saved = await store.save(doc);
    expect(saved.meta.description).toBe(doc.body);
    expect(saved.body).toBe(doc.body);
    expect(saved.meta.custom.keep).toBe(true);
    const cleared = await store.save({ ...saved, body: '' });
    expect(cleared.meta.description).toBe('');
    expect(cleared.body).toBe('');
  }
  const writing = await store.save({ ...sample(), meta: { ...sample().meta, description: 'blog summary' } });
  expect(writing.meta.description).toBe('blog summary');
});
test('save, stale revision conflict, backup and mdx conversion', async () => {
  const first = await store.save(sample());
  await expect(store.save({ ...sample(), body: 'overwrite' })).rejects.toThrow('外部修改');
  const body = insertComponent(first.body, 'Highlight', '<Highlight>word</Highlight>', 0);
  const second = await store.save({ ...first, originalId: first.id, id: first.id.replace('.md', '.mdx'), body });
  expect(second.meta.custom.keep).toBe(true);
  expect(await Bun.file(resolve(store.content, first.id)).exists()).toBe(false);
  expect((await readdir(resolve(store.state, 'versions'))).length).toBe(1);
  await expect(store.save({ ...first, body: 'stale' })).rejects.toThrow();
});
test('external edit is preserved, and simultaneous saves cannot both win', async () => {
  const doc = await store.save(sample());
  const results = await Promise.allSettled([store.save({ ...doc, body: 'first change' }), store.save({ ...doc, body: 'second change' })]);
  expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
  const fresh = await store.read(doc.id);
  await writeFile(resolve(store.content, doc.id), serialize(fresh.meta, 'external'));
  await expect(store.save({ ...fresh, body: 'lost update' })).rejects.toThrow('外部修改');
  expect((await store.read(doc.id)).body).toContain('external');
});
test('failed compilation does not create a file', async () => {
  await expect(store.save({ ...sample(), id: 'writing/bad.mdx', body: '<Highlight>{' })).rejects.toThrow('编译失败');
  expect(await Bun.file(resolve(store.content, 'writing/bad.mdx')).exists()).toBe(false);
  await expect(validateDocument('thought/one.md', sample().meta, 'x')).rejects.toThrow('分类');
});
test('mdx insertion respects existing alias and import boundaries', async () => {
  const body = 'import { Highlight as Mark } from "@components/interactive";\n\nStart';
  const result = insertComponent(body, 'Highlight', '<Highlight>new</Highlight>', 0);
  expect(result).toContain('<Mark>new</Mark>');
  expect(result.match(/import /g)).toHaveLength(1);
  await validateDocument('writing/test.mdx', sample().meta, result);
});
test('Markdown conversion escapes prose syntax without changing math or code', async () => {
  const original = 'A {literal} and 2 < 3.\n\n$x^{2}$\n\n```js\nconst x = { value: 1 };\n```';
  const body = insertComponent(original, 'Highlight', '<Highlight>new</Highlight>', original.length, true);
  expect(body).toContain('\\{literal\\}');
  expect(body).toContain('$x^{2}$');
  expect(body).toContain('const x = { value: 1 };');
  await validateDocument('writing/converted.mdx', sample().meta, body);
});
test('duplicate sidenote identifiers are rejected', () => {
  expect(() => insertComponent('import { Sidenote } from "@components/interactive";\n\n<Sidenote id="1">old</Sidenote>', 'Sidenote', '<Sidenote id={"1"}>new</Sidenote>', 200)).toThrow('唯一编号');
});
test('deletion, bilingual restore and collision protection', async () => {
  const zh = await store.save(sample());
  const en = await store.save({ ...sample(), id: 'writing-en/中文 filename.md' });
  const removed = await store.remove(zh.id, zh.revision, true);
  expect(await store.trash()).toHaveLength(1);
  await expect(store.read(en.id)).rejects.toThrow('不存在');
  await store.save(sample());
  await expect(store.restore(removed.token)).rejects.toThrow('同名');
  const current = await store.read(zh.id); await store.remove(zh.id, current.revision);
  await store.restore(removed.token);
  expect((await store.read(en.id)).meta.title).toBe('中文标题');
});
test('drafts never enter content collections', async () => {
  await store.draft(sample()); expect(await store.list()).toHaveLength(0); expect(await store.drafts()).toHaveLength(1);
  await store.discardDraft(sample().id); expect(await store.drafts()).toHaveLength(0);
});
test('restoring Markdown cannot create a duplicate beside an existing MDX document', async () => {
  const original = await store.save(sample());
  const removed = await store.remove(original.id, original.revision);
  await store.save({ ...sample(), id: original.id.replace('.md', '.mdx') });
  await expect(store.restore(removed.token)).rejects.toThrow('同名');
  expect(await store.list()).toHaveLength(1);
});
test('uploads deduplicate across language, reject fake MIME and protect referenced assets', async () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
  expect(imageType(png)).toBe('png');
  const image = await store.upload(sample().id, new File([png], 'test.png', { type: 'image/png' }));
  const reused = await store.upload('writing-en/中文 filename.md', new File([png], 'other.png', { type: 'image/png' }));
  expect(reused.url).toBe(image.url); expect(reused.reused).toBe(true);
  await expect(store.upload(sample().id, new File(['<svg/>'], 'fake.png', { type: 'image/png' }))).rejects.toThrow('真实');
  await store.save({ ...sample(), body: `![test](${image.url})` });
  await expect(store.deleteAsset(image.url)).rejects.toThrow('引用');
});
test('path traversal and external symlinks are rejected', async () => {
  await expect(store.read('writing/../../secret.md')).rejects.toThrow();
  await symlink(tmpdir(), resolve(root, 'public/escape'));
  await expect(safePath(store.public, 'escape/outside.png')).rejects.toThrow('符号链接');
});
test('relative encoded image references in drafts also prevent image removal', async () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(24).fill(0)]);
  const image = await store.upload(sample().id, new File([png], 'a b.png'));
  await store.draft({ ...sample(), body: '![draft](a%20b.png)' });
  await expect(store.deleteAsset(image.url)).rejects.toThrow('草稿');
});
test('API enforces Host, Origin and per-process session token', async () => {
  const app = await createStudio(root);
  expect((await app.fetch(new Request('http://127.0.0.1:4322/api/init'))).status).toBe(403);
  expect((await app.fetch(new Request('http://evil.example:4322/api/init', { headers: { 'x-studio-token': app.token } }))).status).toBe(403);
  expect((await app.fetch(new Request('http://127.0.0.1:4322/api/init', { headers: { 'x-studio-token': app.token, Origin: 'https://evil.example' } }))).status).toBe(403);
  expect((await app.fetch(new Request('http://127.0.0.1:4322/api/init', { headers: { 'x-studio-token': app.token } }))).status).toBe(200);
  expect((await app.fetch(new Request('http://127.0.0.1:4322/api/preview-stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }))).status).toBe(403);
  expect((await app.fetch(new Request('http://127.0.0.1:4322/api/preview-stop', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-studio-token': app.token }, body: '{}' }))).status).toBe(200);
});
