import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createStudio } from '../studio-server';

const sample = (name = 'one') => ({ id: `writing/${name}.md`, revision: null, meta: { title: name, description: '', pubDate: '2026-10-26' }, body: '中文原文' });
const review = (source: ReturnType<typeof sample>) => ({ document: { ...structuredClone(source), id: source.id.replace('writing/', 'writing-en/'), revision: null, body: 'First line\n\nSecond paragraph' }, models: [{ configuredModel: 'configured', returnedModel: 'returned' }] });

test('translation drafts survive server restart, stay outside collections, and validate source/target ownership', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-translation-draft-'));
  let app = await createStudio(root);
  const call = (route: string, data?: unknown) => app.fetch(new Request(`http://127.0.0.1:4322/api/${route}`, { method: data ? 'POST' : 'GET', headers: { 'x-studio-token': app.token, ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) }));
  try {
    const source = sample(), translation = review(source);
    expect((await call('translation-draft', { source, translation })).status).toBe(200);
    app.close(); app = await createStudio(root);
    const saved = await (await call('translation-draft?id=' + encodeURIComponent(source.id))).json();
    expect(saved.source).toEqual(source);
    expect(saved.translation).toEqual(translation);
    expect(await app.store.list()).toEqual([]);
    expect(await app.store.drafts()).toEqual([]);
    expect((await call('translation-draft', { source, translation: { document: { ...translation.document, id: 'writing-en/other.md' } } })).status).toBe(400);
    expect((await call('translation-draft', { source: { ...source, id: '../escape.md' }, translation })).status).toBe(400);
    const incomplete = { ...translation.document, id: 'writing-en/one.mdx', body: '<Highlight>{' };
    expect((await call('translation-draft', { source, translation: { document: incomplete } })).status).toBe(200);
    expect((await app.store.translationDraft(source.id.replace('.md', '.mdx'))).translation.document.body).toBe('<Highlight>{');
    expect((await call('translation-draft', { id: source.id, discard: true })).status).toBe(200);
    expect(await app.store.translationDraft(source.id)).toBeNull();
    const thought = { ...sample(), id: 'thought/note.md', meta: { ...sample().meta, category: '随笔' } };
    const thoughtTranslation = { document: { ...thought, id: 'thought-en/note.md', body: 'English thought\nWith a line break' } };
    expect((await call('translation-draft', { source: thought, translation: thoughtTranslation })).status).toBe(200);
    const thoughtDraft = await app.store.translationDraft(thought.id);
    expect(thoughtDraft.translation.document.meta.description).toBe(thoughtTranslation.document.body);
  } finally { app.close(); await rm(root, { recursive: true, force: true }); }
});

test('generated and proofread results survive settings, reopening an article, and late replies from another article', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-translation-ui-'));
  await mkdir(resolve(root, 'src/content/writing'), { recursive: true });
  const app = await createStudio(root);
  try {
    const source = await app.store.save(sample());
    const other = await app.store.save(sample('two'));
    const script = await Bun.file(resolve(import.meta.dir, 'app.js')).text();
    const helpers = script.slice(script.indexOf('async function persistTranslation()'), script.indexOf('function go('));
    const load = script.slice(script.indexOf('async function loadPage('), script.indexOf('async function buildPreview('));
    const generate = script.slice(script.indexOf('async function generateTranslation('), script.indexOf('async function deleteDocuments('));
    const input = script.split('\n').find(line => line.includes("if(id.startsWith('translated-')"))!;
    const confirm: any = {};
    const state: any = {
      doc: source, dirty: false, translation: null, translationController: null, translationTimer: null, translationSaving: 0, translationSave: Promise.resolve(),
      chatController: null, chatOpen: false, sourcePosition: 0, previewURL: '', page: 'translations', componentPreviewURL: '', drafts: [],
      window: { STUDIO_TOKEN: 'fixture', dispatchEvent() {} }, Event, AbortController, TextDecoder, Uint8Array, structuredClone,
      setTimeout: () => 1, clearTimeout() {}, render() {}, toast() {}, ensureDoc() {}, btn: () => "", modal() {}, close() {}, refresh: async () => {}, handle: async (work: () => unknown) => work(), escape: (value: string) => value, $: (selector: string) => selector.includes('confirm-translation') ? confirm : null,
      isEnglish: (id: string) => id.split('/')[0].endsWith('-en'), isThought: (id: string) => id.startsWith('thought'), go(next: string) { state.page = next; },
      api: async (route: string, data?: unknown) => {
        const response = await app.fetch(new Request(`http://127.0.0.1:4322/api/${route}`, { method: data ? 'POST' : 'GET', headers: { 'x-studio-token': app.token, ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) }));
        const value = await response.json(); if (!response.ok) throw new Error(value.error); return value;
      },
      fetch: async () => Response.json({}),
    };
    runInNewContext(helpers + load + generate + `\nglobalThis.change=(id,value)=>{const target={value};${input}};`, state);
    const response = () => new Response(JSON.stringify({ type: 'result', ...review(source) }) + '\n');
    state.fetch = async () => response();
    await state.generateTranslation();
    expect((await app.store.translationDraft(source.id)).translation.document.body).toBe(review(source).document.body);
    state.change('translated-title', 'Proofread title');
    state.change('translated-body', 'Proofread body\n\nWith edits');
    await state.loadPage('settings');
    await state.api('settings', { endpoint: 'https://example.invalid', model: 'new-model', maxTokens: 2048 });
    await state.loadPage('translations');
    expect(state.translation.document.meta.title).toBe('Proofread title');
    await state.openDoc(source.id);
    expect(state.translation.document.body).toBe('Proofread body\n\nWith edits');
    await state.loadPage('translations');
    let finish!: (response: Response) => void;
    state.fetch = () => new Promise<Response>(resolve => { finish = resolve; });
    const pending = state.generateTranslation();
    while (!finish) await Bun.sleep(1);
    await state.openDoc(other.id);
    finish(response()); await pending;
    expect(state.doc.id).toBe(other.id);
    expect(state.translation).toBeNull();
    state.fetch = async () => new Response(JSON.stringify({ type: 'result', ...review(other) }) + '\n');
    await state.generateTranslation();
    await state.openDoc(source.id);
    expect(state.translation.document.body).toBe('Proofread body\n\nWith edits');
    expect((await app.store.list()).filter(item => item.id.startsWith('writing-en'))).toHaveLength(0);
    state.fetch = async () => Response.json({ error: 'model unavailable' }, { status: 503 });
    await expect(state.generateTranslation()).rejects.toThrow('model unavailable');
    expect(state.translation.document.body).toBe('Proofread body\n\nWith edits');
    const saveAction = script.slice(script.indexOf("  'save-translated':"), script.indexOf("  'save-settings':"));
    runInNewContext('globalThis.actions={' + saveAction + '};', state);
    await state.actions['save-translated']();
    await confirm.onclick();
    expect((await app.store.read('writing-en/one.md')).body).toBe('Proofread body\n\nWith edits');
    expect(await app.store.translationDraft(source.id)).toBeNull();
    await state.loadPage('settings');
    expect(await app.store.translationDraft(source.id)).toBeNull();
    expect((await app.store.translationDraft(other.id)).translation.document.body).toBe(review(other).document.body);

  } finally { app.close(); await rm(root, { recursive: true, force: true }); }
});
