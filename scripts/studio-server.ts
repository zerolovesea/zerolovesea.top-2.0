import { resolve, extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { ContentStore, AppError, safePath, validId, validateDocument, insertComponent, componentNames, atomic, parseDocument } from './studio/content';
import { Preview } from './studio/preview';
import { Publisher } from './studio/publish';
import { prepareRich } from './studio/rich';
import { buildClient } from './studio/client';
import { chatImages, discuss } from './studio/chat';
import { defaultConfig, messagesURL, callModel, translateDocument, type ModelConfig } from './studio/translate';

export async function createStudio(root: string, options: { port?: number; previewPort?: number; key?: string; token?: string } = {}) {
  const store = new ContentStore(root);
  const publisher = new Publisher(root);
  const port = options.port || 4322;
  const preview = new Preview(store, options.previewPort || 4323);
  const token = options.token || randomBytes(32).toString('hex');
  let key = options.key || process.env.STUDIO_LLM_API_KEY || '';
  let config: ModelConfig = { ...defaultConfig };
  try {
    const saved = JSON.parse(await readFile(resolve(store.state, 'model.json'), 'utf8'));
    const { endpoint, model, maxTokens } = { ...config, ...saved };
    config = { endpoint, model, maxTokens };
    key ||= typeof saved.key === 'string' ? saved.key : '';
  } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  const json = (value: any, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  const modelStatus = () => ({ ...config, hasKey: Boolean(key) });
  async function payload(request: Request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('需要 JSON 请求');
    const body = await request.text();
    if (body.length > 2_200_000) throw new AppError('请求超过 2 mb', 413);
    try { const value = JSON.parse(body); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new AppError('需要 JSON 对象'); }
  }
  async function fetchRequest(request: Request) {
    try {
      const url = new URL(request.url);
      const expectedHost = `127.0.0.1:${port}`;
      if (![expectedHost, `localhost:${port}`].includes(url.host)) throw new AppError('不允许的 Host', 403);
      const origin = request.headers.get('origin');
      if (origin && ![`http://${expectedHost}`, `http://localhost:${port}`].includes(origin)) throw new AppError('不允许的来源', 403);
      if (url.pathname.startsWith('/api/')) {
        if (request.headers.get('x-studio-token') !== token) throw new AppError('本地会话无效，请刷新页面', 403);
        const route = url.pathname;
        if (request.method === 'GET') {
          if (route === '/api/publish-plan') return json(await publisher.plan());
          if (route === '/api/publish-status') return json(publisher.state);
          if (route === '/api/init') return json({ documents: await store.list(), drafts: await store.drafts(), config: modelStatus(), components: componentNames });
          if (route === '/api/document') return json(await store.read(url.searchParams.get('id') || ''));
          if (route === '/api/translation-draft') return json(await store.translationDraft(url.searchParams.get('id') || ''));
          if (route === '/api/assets') return json(await store.assets());
          if (route === '/api/trash') return json(await store.trash());
          if (route === '/api/versions') {
            const id = url.searchParams.get('id') || ''; validId(id);
            const { filesUnder } = await import('./studio/content');
            const versions = [];
            for (const file of await filesUnder(resolve(store.state, 'versions'))) if (/^[a-z0-9-]+\.json$/.test(file)) {
              const version = JSON.parse(await readFile(resolve(store.state, 'versions', file), 'utf8'));
              if (version.id.replace(/\.mdx?$/, '') === id.replace(/\.mdx?$/, '')) versions.push(version);
            }
            return json(versions.sort((a, b) => b.date.localeCompare(a.date)));
          }
          return json({ error: '接口不存在' }, 404);
        }
        if (request.method !== 'POST') return json({ error: '不支持此方法' }, 405);
        if (route === '/api/upload') {
          const form = await request.formData();
          const id = String(form.get('id') || '');
          const file = form.get('file');
          if (!(file instanceof File)) throw new AppError('缺少图片文件');
          return json(await store.upload(id, file));
        }
        const data = await payload(request);
        if (route === '/api/publish') { if (data.confirmation !== '发布网站' || typeof data.fingerprint !== 'string') throw new AppError('请确认发布清单'); return json(await publisher.start(data.fingerprint)); }
        if (route === '/api/parse') { validId(data.id); if (typeof data.raw !== 'string' || data.raw.length > 2_000_000) throw new AppError('导入文档过大'); return json({ id: data.id, ...parseDocument(data.raw), revision: null }); }
        if (route === '/api/save') { const doc = await store.save(data); await store.discardDraft(data.originalId || data.id); if (data.originalId !== data.id) await store.discardDraft(data.id); return json(doc); }
        if (route === '/api/draft') return json(await store.draft(data));
        if (route === '/api/translation-draft') return json(await store.saveTranslationDraft(data));
        if (route === '/api/discard-draft') { await store.discardDraft(data.id); return json({ ok: true }); }
        if (route === '/api/delete') return json(await store.remove(data.id, data.revision, data.english === true));
        if (route === '/api/restore') return json(await store.restore(data.token));
        if (route === '/api/clear-trash') return json(await store.clearTrash(data.confirmation));
        if (route === '/api/delete-asset') return json(await store.deleteAsset(data.url));
        if (route === '/api/component') { validId(data.id); return json({ body: insertComponent(data.body, data.name, data.snippet, data.position, data.id.endsWith('.md')) }); }
        if (route === '/api/rich-prepare') return json(prepareRich(data.id, data.body));
        if (route === '/api/validate') { await validateDocument(data.id, data.meta, data.body); return json({ ok: true }); }
        if (route === '/api/component-preview') return json(await preview.components());
        if (route === '/api/chat-images') return json(await chatImages(store, data.document));
        if (route === '/api/chat') return json(await discuss(store, data, config, key, request.signal));
        if (route === '/api/preview-stop') { await preview.pause(); return json({ ok: true }); }
        if (route === '/api/preview') return json(await preview.prepare(data));
        if (route === '/api/settings') {
          if (typeof data.endpoint !== 'string' || typeof data.model !== 'string' || !data.model.trim()) throw new AppError('请填写接口与模型名称');
          messagesURL(data.endpoint);
          const maxTokens = Number(data.maxTokens);
          if (!Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 32000) throw new AppError('max_tokens 范围为 256–32000');
          if (data.key !== undefined && typeof data.key !== 'string') throw new AppError('密钥格式无效');
          const nextConfig = { endpoint: data.endpoint.trim(), model: data.model.trim(), maxTokens };
          let nextKey = new URL(nextConfig.endpoint).origin === new URL(config.endpoint).origin ? key : '';
          if (data.key?.trim()) nextKey = data.key.trim();
          if (data.clearKey) nextKey = '';
          await atomic(resolve(store.state, 'model.json'), JSON.stringify({ ...nextConfig, key: nextKey }));
          config = nextConfig;
          key = nextKey;
          return json(modelStatus());
        }
        if (route === '/api/test-model') {
          const result = await callModel(config, key, 'Reply with exactly CONNECTION_OK. No explanation.', request.signal);
          return json({ ...result, text: undefined, success: result.text.trim() === 'CONNECTION_OK' });
        }
        if (route === '/api/translate') {
          await validateDocument(data.id, data.meta, data.body);
          if (data.id.split('/')[0].endsWith('-en')) throw new AppError('请选择中文内容生成英文版');
          if (!key) throw new AppError('请先配置模型密钥');
          const targetCollection = data.id.split('/')[0] + '-en';
          const targetStem = data.id.split('/')[1].replace(/\.mdx?$/, '');
          let existing: any = null;
          for (const extension of ['md', 'mdx']) {
            try { existing = await store.read(`${targetCollection}/${targetStem}.${extension}`); break; } catch (error) { if (!(error instanceof AppError && error.status === 404)) throw error; }
          }
          const cancellation = new AbortController();
          request.signal.addEventListener('abort', () => cancellation.abort(), { once: true });
          const stream = new ReadableStream({
            async start(controller) {
              const send = (value: any) => { try { controller.enqueue(new TextEncoder().encode(JSON.stringify(value) + '\n')); } catch {} };
              try {
                send({ type: 'progress', done: 0, total: 0 });
                const result = await translateDocument(data, config, key, cancellation.signal, send);
                result.document.revision = existing?.revision ?? null;
                Object.assign(result.document, { originalId: existing?.id ?? result.document.id });
                send({ type: 'result', ...result });
              } catch (error) { send({ type: 'error', error: error instanceof Error ? error.message : '翻译失败' }); }
              finally { try { controller.close(); } catch {} }
            },
            cancel() { cancellation.abort(); },
          });
          return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        throw new AppError('接口不存在', 404);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new AppError('不支持此方法', 405);
      if (url.pathname === '/') {
        const html = await readFile(resolve(root, 'scripts/studio/index.html'), 'utf8');
        return new Response(html.replace('__STUDIO_TOKEN__', token), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' } });
      }
      let path: string;
      if (url.pathname === '/app.js') path = resolve(root, 'scripts/studio/app.js');
      else if (url.pathname === '/studio.css') path = resolve(root, 'design/local-studio/studio.css');
      else if (url.pathname === '/app.css') path = resolve(root, 'scripts/studio/app.css');
      else if (url.pathname.startsWith('/client/')) path = await safePath(resolve(store.state, 'client'), decodeURIComponent(url.pathname.slice(8)));
      else if (url.pathname.startsWith('/site/')) path = await safePath(store.public, decodeURIComponent(url.pathname.slice(6)));
      else if (/^\/_(posts|thoughts)\//.test(url.pathname)) path = await safePath(store.public, decodeURIComponent(url.pathname.slice(1)));
      else throw new AppError('文件不存在', 404);
      const file = Bun.file(path);
      if (!await file.exists()) throw new AppError('文件不存在', 404);
      return new Response(request.method === 'HEAD' ? null : file, { headers: { 'Content-Type': file.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch (error: any) {
      const status = error instanceof AppError ? error.status : error.code === 'ENOENT' ? 404 : 500;
      return json({ error: error instanceof AppError ? error.message : error.name === 'AbortError' || error.name === 'TimeoutError' ? '操作已取消或超时' : '本地服务操作失败，请检查文件权限或重试' }, status);
    }
  }
  return { fetch: fetchRequest, store, preview, token, close: () => preview.stop() };
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..');
  const port = Number(process.env.STUDIO_PORT || 4322);
  const key = process.argv.includes('--ask-key') ? prompt('API key（仅本次运行）:') || '' : undefined;
  await buildClient(root);
  const app = await createStudio(root, { port, previewPort: Number(process.env.STUDIO_PREVIEW_PORT || 4323), key, token: process.env.STUDIO_NATIVE_TOKEN });
  const server = Bun.serve({ hostname: '127.0.0.1', port, idleTimeout: 255, maxRequestBodySize: 24 * 1024 * 1024, fetch: app.fetch });
  console.log(`local studio → ${server.url}\n本地内容管理，保存不会部署。`);
  const shutdown = () => { app.close(); server.stop(true); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  if (process.argv.includes('--open')) Bun.spawn(['open', server.url.toString()], { stdout: 'ignore', stderr: 'ignore' });
}
