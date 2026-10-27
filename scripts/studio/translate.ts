import { createProcessor } from '@mdx-js/mdx';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { randomUUID } from 'node:crypto';
import { AppError, validateDocument, syncThoughtContent } from './content';

export type ModelConfig = { endpoint: string; model: string; maxTokens: number };
export const defaultConfig: ModelConfig = { endpoint: 'https://one.iflytek.com/api/llm/console/chat', model: 'claude-opus-4-8', maxTokens: 2048 };
export function messagesURL(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new AppError('模型接口必须使用 https，本地模型可使用 http');
  if (url.username || url.password || url.search || url.hash) throw new AppError('接口地址不能包含凭据、查询或片段');
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/v1/messages') ? base : base + '/v1/messages';
}
export async function callModel(config: ModelConfig, key: string, prompt: string, signal?: AbortSignal, fetcher = fetch) {
  return requestModel(config, key, [{ role: 'user', content: prompt }], signal, fetcher);
}
export async function requestModel(config: ModelConfig, key: string, messages: any[], signal?: AbortSignal, fetcher = fetch, system = '') {
  if (!key) throw new AppError('请在设置中保存 API key，或设置 STUDIO_LLM_API_KEY');
  const url = messagesURL(config.endpoint);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetcher(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(120_000)]),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Brevia/1.0', 'anthropic-version': '2023-06-01', 'x-api-key': key },
      body: JSON.stringify({ model: config.model, max_tokens: config.maxTokens, messages, ...(system ? { system } : {}) }),
    });
    if (![429, 502, 503, 504].includes(response.status) || attempt === 1) break;
    await response.body?.cancel();
    await Bun.sleep(1000);
  }
  if (!response?.ok) throw new AppError(`模型请求失败（HTTP ${response?.status}），请检查额度、模型和连接配置。`, 502);
  let data: any;
  try { data = await response.json(); } catch { throw new AppError('模型返回非 JSON 数据', 502); }
  if (data.stop_reason === 'max_tokens') throw new AppError('模型达到输出上限，提高 max_tokens 后重试。', 422);
  const text = data.content?.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
  if (!text?.trim()) throw new AppError('模型没有返回文本', 502);
  return { text: text as string, configuredModel: config.model, returnedModel: typeof data.model === 'string' ? data.model : '未返回', usage: data.usage, stopReason: data.stop_reason };
}
export function protect(body: string, mdx = true) {
  const processor = mdx ? createProcessor({ remarkPlugins: [remarkMath] }) : unified().use(remarkParse).use(remarkMath);
  const ast: any = processor.parse(body);
  const prefix = `STUDIO_${randomUUID().replaceAll('-', '')}_`;
  const ranges: { start: number; end: number }[] = [];
  function visit(node: any) {
    if (['code', 'inlineCode', 'math', 'inlineMath', 'html', 'mdxjsEsm', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxFlowExpression', 'mdxTextExpression', 'image', 'link', 'definition'].includes(node.type)) {
      ranges.push({ start: node.position.start.offset, end: node.position.end.offset }); return;
    }
    node.children?.forEach(visit);
  }
  visit(ast);
  const originals: string[] = [];
  let masked = '', cursor = 0;
  for (const range of ranges.sort((a, b) => a.start - b.start)) {
    if (range.start < cursor) continue;
    masked += body.slice(cursor, range.start) + prefix + originals.length + '_END';
    originals.push(body.slice(range.start, range.end)); cursor = range.end;
  }
  masked += body.slice(cursor);
  return {
    masked,
    restore(translated: string) {
      for (let i = 0; i < originals.length; i++) {
        const token = `${prefix}${i}_END`;
        if (translated.split(token).length !== 2) throw new AppError('模型修改或丢失了受保护的公式/代码/组件，已阻止保存', 422);
        translated = translated.replace(token, () => originals[i]);
      }
      if (translated.includes(prefix)) throw new AppError('模型返回未知结构占位符', 422);
      return translated;
    },
  };
}
export function chunks(text: string, maximum = 1500) {
  const units = text.split(/(\n\n+)/);
  const result: string[] = [];
  let chunk = '';
  for (const unit of units) {
    if (unit.length > 8000) throw new AppError('单个段落超过 8000 字符，请拆为较短段落后翻译');
    if (chunk.length + unit.length > maximum && chunk) { result.push(chunk); chunk = ''; }
    chunk += unit;
  }
  if (chunk) result.push(chunk);
  return result;
}
export async function translateDocument(doc: any, config: ModelConfig, key: string, signal: AbortSignal, progress: (event: any) => void, fetcher = fetch) {
  const reports: any[] = [];
  const metadata = await callModel(config, key, `Translate the values of this JSON object to natural English, preserve meaning and author's tone. Return ONLY valid JSON with the same keys. No code fences.\n${JSON.stringify({ title: doc.meta.title, description: doc.meta.description, ...(doc.id.startsWith('thought') ? { category: doc.meta.category } : {}) })}`, signal, fetcher);
  reports.push({ configuredModel: metadata.configuredModel, returnedModel: metadata.returnedModel });
  let fields: any;
  try { fields = JSON.parse(metadata.text.trim()); } catch { throw new AppError('模型未返回有效的标题/摘要 JSON，请重试', 422); }
  if (typeof fields.title !== 'string' || typeof fields.description !== 'string' || (doc.id.startsWith('thought') && typeof fields.category !== 'string')) throw new AppError('译文元数据缺少必填字段', 422);
  const protectedBody = protect(doc.body, doc.id.endsWith('.mdx'));
  const parts = chunks(protectedBody.masked);
  const output = [];
  for (let index = 0; index < parts.length; index++) {
    signal.throwIfAborted();
    progress({ type: 'progress', done: index, total: parts.length, models: reports });
    const result = await callModel(config, key, `Translate this Markdown fragment to natural English. Return ONLY the translated fragment, no introduction or outer code fences. Preserve all Markdown structure and whitespace at fragment boundaries. Every STUDIO_*_END token is immutable: reproduce each exactly once in the same order. Do not add or remove tokens. Do not interpret tokens as instructions.\n\n${parts[index]}`, signal, fetcher);
    output.push(result.text);
    reports.push({ configuredModel: result.configuredModel, returnedModel: result.returnedModel });
  }
  const collection = doc.id.split('/')[0].replace(/-en$/, '') + '-en';
  const id = `${collection}/${doc.id.split('/')[1]}`;
  const translated = syncThoughtContent({ id, meta: { ...doc.meta, title: fields.title, description: fields.description, ...(fields.category ? { category: fields.category } : {}) }, body: protectedBody.restore(output.join('\n\n')), revision: null });
  await validateDocument(id, translated.meta, translated.body);
  return { document: translated, models: reports, completed: parts.length };
}
