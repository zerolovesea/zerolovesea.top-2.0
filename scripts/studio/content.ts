import { mkdir, readdir, readFile, writeFile, rename, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, basename, extname, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { compile, createProcessor } from '@mdx-js/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export const collections = ['writing', 'writing-en', 'thought', 'thought-en'];
export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const hash = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex');
export const stem = (id: string) => basename(id).replace(/\.(md|mdx)$/, '');
export const assetGroup = (id: string) => id.startsWith('thought') ? '_thoughts' : '_posts';
function referencesAsset(doc: any, item: { url: string; group: string; folder: string; name: string }) {
  const body = doc.body || '';
  if (body.includes(item.url) || body.includes(decodeURIComponent(item.url)) || doc.meta?.heroImage === item.url || doc.meta?.heroImage === decodeURIComponent(item.url)) return true;
  return assetGroup(doc.id) === item.group && stem(doc.id) === item.folder && (body.includes(item.name) || body.includes(encodeURIComponent(item.name)));
}
export function validId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^(writing|writing-en|thought|thought-en)\/[^/\\\x00-\x1f]+\.(md|mdx)$/.test(id) || basename(id).startsWith('.')) throw new AppError('内容路径无效');
}
export function parseDocument(raw: string) {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)(?:\r?\n)?/);
  if (!match) throw new AppError('缺少 YAML frontmatter');
  const meta = Bun.YAML.parse(match[1]);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new AppError('frontmatter 必须是对象');
  try { JSON.stringify(meta); } catch { throw new AppError('frontmatter 不能包含循环别名或无法序列化的值'); }
  return { meta: meta as Record<string, any>, body: raw.replace(/^\uFEFF/, '').slice(match[0].length) };
}
export function serialize(meta: Record<string, any>, body: string) {
  return `---\n${Bun.YAML.stringify(meta, null, 2).trim()}\n---\n\n${body}`;
}
export function syncThoughtContent(doc: any) {
  if (doc.id.startsWith('thought')) doc.meta = { ...doc.meta, description: doc.body };
  return doc;
}
export async function validateDocument(id: string, meta: any, body: unknown) {
  validId(id);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta) || typeof body !== 'string' || body.length > 2_000_000) throw new AppError('文档格式无效或超过 2 mb');
  if (typeof meta.title !== 'string' || !meta.title.trim() || typeof meta.description !== 'string' || !Number.isFinite(Date.parse(meta.pubDate))) throw new AppError('请填写标题、摘要与有效发布日期（摘要允许为空）');
  if (id.startsWith('thought') && (typeof meta.category !== 'string' || !meta.category.trim())) throw new AppError('thought 需要分类');
  if (meta.updatedDate !== undefined && !Number.isFinite(Date.parse(meta.updatedDate))) throw new AppError('更新日期无效');
  if (meta.readingTime !== undefined && (typeof meta.readingTime !== 'number' || !Number.isFinite(meta.readingTime))) throw new AppError('readingTime 必须为数字');
  if (meta.heroImage !== undefined && typeof meta.heroImage !== 'string') throw new AppError('封面路径必须为字符串');
  if (meta.showTldr !== undefined && typeof meta.showTldr !== 'boolean') throw new AppError('showTldr 必须为布尔值');
  try {
    if (id.endsWith('.mdx')) await compile(body, { remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: true }]] });
    else {
      const processor = await createMarkdownProcessor({ syntaxHighlight: false, remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, { throwOnError: true }]] });
      await processor.render(body);
    }
  } catch (error) { throw new AppError(`文档/公式编译失败：${error instanceof Error ? error.message : '未知错误'}`); }
}

export async function safePath(root: string, relative: string) {
  const path = resolve(root, relative);
  if (!path.startsWith(resolve(root) + sep)) throw new AppError('路径超出允许范围');
  let existing = path;
  while (true) {
    try {
      const actual = await realpath(existing);
      const base = await realpath(root);
      if (actual !== base && !actual.startsWith(base + sep)) throw new AppError('不允许指向工作区外的符号链接');
      break;
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) throw error;
      existing = parent;
    }
  }
  return path;
}
export async function atomic(path: string, value: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, value, { flag: 'wx', mode: 0o600 }); await rename(temporary, path); }
  finally { await unlink(temporary).catch(() => {}); }
}
export async function filesUnder(root: string, relative = ''): Promise<string[]> {
  let entries;
  try { entries = await readdir(resolve(root, relative), { withFileTypes: true }); }
  catch (error: any) { if (error.code === 'ENOENT') return []; throw error; }
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await filesUnder(root, path)); else if (entry.isFile()) result.push(path);
  }
  return result;
}

export class ContentStore {
  content: string;
  state: string;
  public: string;
  private writes = Promise.resolve();
  constructor(public root: string) {
    this.content = resolve(root, 'src/content'); this.state = resolve(root, '.local-studio'); this.public = resolve(root, 'public');
  }
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    const operation = this.writes.then(work);
    this.writes = operation.then(() => {}, () => {});
    return operation;
  }
  async read(id: string) {
    validId(id);
    const path = await safePath(this.content, id);
    let raw: string;
    try { raw = await readFile(path, 'utf8'); } catch (error: any) { if (error.code === 'ENOENT') throw new AppError('文档不存在', 404); throw error; }
    return { id, ...parseDocument(raw), revision: hash(raw) };
  }
  async list() {
    const result = [];
    for (const collection of collections) {
      for (const file of await filesUnder(resolve(this.content, collection))) {
        if (!/\.(md|mdx)$/.test(file) || file.includes('/')) continue;
        const id = `${collection}/${file}`;
        try { const doc = await this.read(id); result.push({ id, meta: doc.meta, revision: doc.revision, format: extname(file).slice(1) }); }
        catch (error) { result.push({ id, error: error instanceof Error ? error.message : '读取失败' }); }
      }
    }
    return result;
  }
  async backup(id: string, raw: string) {
    await atomic(resolve(this.state, 'versions', `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ id, raw, date: new Date().toISOString() }));
  }
  async save(doc: any) {
    await validateDocument(doc.id, doc.meta, doc.body);
    syncThoughtContent(doc);
    return this.exclusive(async () => {
      const originalId = doc.originalId || doc.id;
      validId(originalId);
      if (originalId !== doc.id && originalId.replace(/\.mdx?$/, '') !== doc.id.replace(/\.mdx?$/, '')) throw new AppError('不支持在保存时重命名或跨集合移动文件');
      const path = await safePath(this.content, originalId);
      let old: string | null = null;
      try { old = await readFile(path, 'utf8'); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      if (doc.revision !== (old === null ? null : hash(old))) throw new AppError('文件已被外部修改或同名文件已存在。请重新加载比较后再保存。', 409);
      const target = await safePath(this.content, doc.id);
      const other = await safePath(this.content, doc.id.replace(/\.mdx?$/, doc.id.endsWith('.mdx') ? '.md' : '.mdx'));
      if (other !== path && await Bun.file(other).exists()) throw new AppError('存在同名的另一种扩展名文件', 409);
      if (target !== path && await Bun.file(target).exists()) throw new AppError('目标 mdx 已存在', 409);
      const oldParsed = old === null ? null : parseDocument(old);
      if (oldParsed && serialize(oldParsed.meta, oldParsed.body) !== serialize(doc.meta, doc.body)) doc.meta = { ...doc.meta, updatedDate: new Date().toISOString() };
      const raw = serialize(doc.meta, doc.body);
      if (old !== null) await this.backup(originalId, old);
      await mkdir(dirname(target), { recursive: true });
      if (old === null) await writeFile(target, raw, { flag: 'wx' });
      else {
        if (hash(await readFile(path, 'utf8')) !== doc.revision) throw new AppError('文件刚刚被其他程序修改，请重新加载', 409);
        await atomic(target, raw);
        if (target !== path) {
          try { await unlink(path); } catch (error) { await unlink(target); throw error; }
        }
      }
      return this.read(doc.id);
    });
  }
  async draft(doc: any) {
    validId(doc.id);
    if (typeof doc.body !== 'string' || doc.body.length > 2_000_000) throw new AppError('草稿无效');
    syncThoughtContent(doc);
    const key = hash(doc.id);
    await atomic(resolve(this.state, 'drafts', `${key}.json`), JSON.stringify({ ...doc, savedAt: new Date().toISOString() }));
    return { key };
  }
  async drafts() {
    const result = [];
    for (const file of await filesUnder(resolve(this.state, 'drafts'))) if (/^[a-f0-9]+\.json$/.test(file)) result.push(JSON.parse(await readFile(resolve(this.state, 'drafts', file), 'utf8')));
    return result;
  }
  async discardDraft(id: string) { validId(id); await unlink(resolve(this.state, 'drafts', `${hash(id)}.json`)).catch(() => {}); }
  async translationDraft(id: string) {
    validId(id);
    const path = resolve(this.state, 'translation-drafts', `${hash(id.replace(/\.mdx?$/, ''))}.json`);
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async saveTranslationDraft(data: any) {
    const id = data.source?.id || data.id;
    validId(id);
    if (id.split('/')[0].endsWith('-en')) throw new AppError('临时译文需要关联中文原文');
    const path = resolve(this.state, 'translation-drafts', `${hash(id.replace(/\.mdx?$/, ''))}.json`);
    if (data.discard === true) {
      await unlink(path).catch((error: any) => { if (error.code !== 'ENOENT') throw error; });
      return { ok: true };
    }
    const target = data.translation?.document;
    validId(target?.id);
    if (target.id.split('/')[0] !== `${id.split('/')[0]}-en` || stem(target.id) !== stem(id)) throw new AppError('临时译文与原文不匹配');
    for (const doc of [data.source, target]) {
      if (!doc?.meta || typeof doc.meta !== 'object' || Array.isArray(doc.meta) || typeof doc.body !== 'string' || doc.body.length > 2_000_000) throw new AppError('临时译文格式无效或过大');
    }
    syncThoughtContent(target);
    await atomic(path, JSON.stringify({ source: data.source, translation: data.translation, savedAt: new Date().toISOString() }));
    return { ok: true };
  }
  async remove(id: string, revision: string, english = false) {
    return this.exclusive(async () => {
      const doc = await this.read(id);
      if (doc.revision !== revision) throw new AppError('文件已修改，请重新加载后删除', 409);
      const ids = [id];
      if (english && !id.split('/')[0].endsWith('-en')) {
        const prefix = id.split('/')[0] + '-en';
        for (const extension of ['md', 'mdx']) {
          const next = `${prefix}/${stem(id)}.${extension}`;
          if (await Bun.file(await safePath(this.content, next)).exists()) ids.push(next);
        }
      }
      const token = randomUUID();
      const bundle = { token, date: new Date().toISOString(), files: await Promise.all(ids.map(async current => ({ id: current, raw: await readFile(await safePath(this.content, current), 'utf8') }))) };
      await atomic(resolve(this.state, 'trash', `${token}.json`), JSON.stringify(bundle));
      const removed: typeof bundle.files = [];
      try {
        for (const file of bundle.files) {
          if (await readFile(await safePath(this.content, file.id), 'utf8') !== file.raw) throw new AppError('删除时文件发生变化', 409);
          await unlink(await safePath(this.content, file.id)); removed.push(file);
        }
      } catch (error) {
        for (const file of removed) await writeFile(await safePath(this.content, file.id), file.raw, { flag: 'wx' });
        await unlink(resolve(this.state, 'trash', `${token}.json`)); throw error;
      }
      return { token };
    });
  }
  async trash() {
    const result = [];
    for (const file of await filesUnder(resolve(this.state, 'trash'))) if (/^[a-f0-9-]+\.json$/.test(file)) {
      const bundle = JSON.parse(await readFile(resolve(this.state, 'trash', file), 'utf8'));
      result.push({ token: bundle.token, date: bundle.date, ids: bundle.files.map((x: any) => x.id) });
    }
    return result;
  }
  async restore(token: string) {
    if (!/^[a-f0-9-]{36}$/.test(token)) throw new AppError('恢复标识无效');
    return this.exclusive(async () => {
      const path = resolve(this.state, 'trash', `${token}.json`);
      const bundle = JSON.parse(await readFile(path, 'utf8'));
      for (const file of bundle.files) {
        validId(file.id);
        const alternate = file.id.replace(/\.mdx?$/, file.id.endsWith('.mdx') ? '.md' : '.mdx');
        if (await Bun.file(await safePath(this.content, file.id)).exists() || await Bun.file(await safePath(this.content, alternate)).exists()) throw new AppError('恢复位置已有同名文件（md / mdx），未覆盖', 409);
      }
      const restored: string[] = [];
      try {
        for (const file of bundle.files) { const target = await safePath(this.content, file.id); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.raw, { flag: 'wx' }); restored.push(target); }
      } catch (error) { for (const file of restored) await unlink(file); throw error; }
      await unlink(path);
      return { restored: bundle.files.map((x: any) => x.id) };
    });
  }
  async clearTrash(confirmation: string) {
    if (confirmation !== '清空') throw new AppError('请输入“清空”');
    return this.exclusive(async () => { for (const item of await this.trash()) await unlink(resolve(this.state, 'trash', `${item.token}.json`)); return { ok: true }; });
  }
  async upload(id: string, file: File) {
    validId(id);
    if (file.size === 0 || file.size > 20 * 1024 * 1024) throw new AppError('图片必须小于 20 mb 且非空');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = imageType(bytes);
    if (!type) throw new AppError('仅支持真实的 png / jpeg / webp / gif 图片');
    return this.exclusive(async () => {
      const directory = `${assetGroup(id)}/${stem(id)}`;
      const folder = await safePath(this.public, directory);
      await mkdir(folder, { recursive: true });
      const digest = hash(bytes);
      for (const existing of await readdir(folder)) {
        const candidate = await safePath(this.public, `${directory}/${existing}`);
        if (!(await lstat(candidate)).isFile()) continue;
        if (hash(await readFile(candidate)) === digest) return asset(directory, existing, true);
      }
      const nameStem = basename(file.name || 'image', extname(file.name || '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/^\.+/, '').slice(0, 100) || 'image';
      let name = `${nameStem}.${type}`;
      if (await Bun.file(resolve(folder, name)).exists()) name = `${nameStem}-${digest.slice(0, 12)}.${type}`;
      await writeFile(await safePath(this.public, `${directory}/${name}`), bytes, { flag: 'wx' });
      return asset(directory, name, false);
    });
  }
  async assets() {
    const docs = await this.list();
    const sources = await Promise.all(docs.filter(x => !x.error).map(x => this.read(x.id)));
    const result = [];
    for (const group of ['_posts', '_thoughts']) for (const file of await filesUnder(resolve(this.public, group))) {
      if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) continue;
      const parts = file.split('/');
      if (parts.length !== 2) continue;
      const url = `/${group}/${parts.map(encodeURIComponent).join('/')}`;
      const refs = sources.filter(doc => referencesAsset(doc, { url, group, folder: parts[0], name: parts[1] })).map(x => x.id);
      result.push({ url, name: parts[1], folder: parts[0], group, refs, size: (await Bun.file(await safePath(this.public, `${group}/${file}`)).size) });
    }
    return result;
  }
  async deleteAsset(url: string) {
    return this.exclusive(async () => {
      const item = (await this.assets()).find(x => x.url === url);
      if (!item) throw new AppError('图片不存在', 404);
      if (item.refs.length) throw new AppError(`图片仍被引用：${item.refs.join('、')}`, 409);
      const draftRefs = (await this.drafts()).some(doc => referencesAsset(doc, item));
      if (draftRefs) throw new AppError('图片仍被本地草稿引用', 409);
      const file = await safePath(this.public, decodeURIComponent(url).slice(1));
      await mkdir(resolve(this.state, 'removed-images'), { recursive: true });
      await rename(file, resolve(this.state, 'removed-images', `${randomUUID()}-${item.name}`));
      return { ok: true };
    });
  }
}
function asset(directory: string, name: string, reused: boolean) { return { url: `/${directory.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(name)}`, name, reused }; }
export function imageType(bytes: Uint8Array) {
  if (bytes.length >= 24 && bytes.slice(0, 8).every((x, i) => x === [137, 80, 78, 71, 13, 10, 26, 10][i])) return 'png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (bytes.length >= 13 && (text.startsWith('GIF87a') || text.startsWith('GIF89a'))) return 'gif';
  if (text.startsWith('RIFF') && text.slice(8) === 'WEBP') return 'webp';
  return null;
}

export const componentNames = ['Highlight', 'Sidenote', 'RevealQuote', 'DecisionToggle', 'FlipCards', 'EnergyMeter', 'DecisionForm', 'AgentSimulation', 'CommitCompare'];
export function markdownToMdx(body: string, position: number) {
  const tree: any = unified().use(remarkParse).use(remarkMath).parse(body);
  const edits: { start: number; end: number; value: string }[] = [];
  function visit(node: any) {
    if (node.type === 'text') {
      const start = node.position.start.offset, end = node.position.end.offset;
      const raw = body.slice(start, end);
      for (const match of raw.matchAll(/(?<!\\)[{}<]/g)) {
        edits.push({ start: start + match.index!, end: start + match.index! + 1, value: match[0] === '<' ? '&lt;' : '\\' + match[0] });
      }
      return;
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  const shifted = position + edits.filter(edit => edit.start < position).reduce((sum, edit) => sum + edit.value.length - 1, 0);
  for (const edit of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, edit.start) + edit.value + body.slice(edit.end);
  return { body, position: shifted };
}
export function insertComponent(body: string, name: string, snippet: string, position: number, markdown = false) {
  if (!componentNames.includes(name) || typeof snippet !== 'string') throw new AppError('未知组件');
  position = Math.max(0, Math.min(body.length, Number(position) || 0));
  if (markdown) ({ body, position } = markdownToMdx(body, position));
  const ast = createProcessor({ remarkPlugins: [remarkMath] }).parse(body);
  const imports: any[] = ast.children.filter((x: any) => x.type === 'mdxjsEsm');
  const existing = imports.find(x => new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]@components/interactive['"]`).test(x.value));
  if (existing) {
    const alias = existing.value.match(new RegExp(`\\b${name}\\s+as\\s+(\\w+)`))?.[1];
    if (alias) snippet = snippet.replace(new RegExp(`(<\\/?)${name}\\b`, 'g'), `$1${alias}`);
  }
  if (name === 'Sidenote') {
    const ids: string[] = [];
    const alias = existing?.value.match(/\bSidenote\s+as\s+(\w+)/)?.[1];
    function collect(node: any) {
      if ([name, alias].includes(node.name)) {
        const attr = node.attributes?.find((x: any) => x.name === 'id');
        if (typeof attr?.value === 'string') ids.push(attr.value);
        else if (attr?.value?.value) { try { ids.push(String(JSON.parse(attr.value.value))); } catch {} }
      }
      node.children?.forEach(collect);
    }
    const candidate = createProcessor({ remarkPlugins: [remarkMath] }).parse(snippet);
    collect(candidate);
    const proposed = ids.pop();
    collect(ast);
    if (!proposed || ids.includes(proposed)) throw new AppError('页边注释编号为空或已使用，请选择唯一编号');
  }
  const importEnd = imports.reduce((end, x) => Math.max(end, x.position.end.offset), 0);
  position = Math.max(position, importEnd);
  let result = body.slice(0, position) + '\n\n' + snippet + '\n\n' + body.slice(position);
  if (!existing) result = `import { ${name} } from "@components/interactive";\n\n` + result;
  return result;
}
