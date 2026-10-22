import { Editor, Node, InputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, MarkdownManager } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function rawNode(inline) {
  return Node.create({
    name: inline ? 'rawInline' : 'rawBlock', group: inline ? 'inline' : 'block', inline, atom: true,
    addAttributes: () => ({ raw: { default: '' }, kind: { default: '' } }),
    parseHTML: () => [{ tag: inline ? 'span[data-raw-inline]' : 'div[data-raw-block]' }],
    renderHTML: ({ node }) => [inline ? 'span' : 'div', { [inline ? 'data-raw-inline' : 'data-raw-block']: '', 'data-raw': node.attrs.raw }, node.attrs.raw],
    renderMarkdown: node => node.attrs.raw,
    addInputRules() { return inline ? [new InputRule({ find: /\$([^$\n]+)\$$/, handler: ({ state, range, match }) => { state.tr.replaceWith(range.from, range.to, this.type.create({ raw: match[0], kind: 'inlineMath' })); } })] : []; },
    addNodeView() {
      return ({ node, getPos, editor }) => {
        const dom = document.createElement(inline ? 'span' : 'div');
        dom.className = 'rich-raw' + (inline ? ' inline' : '');
        dom.contentEditable = 'false';
        const math = ['math', 'inlineMath'].includes(node.attrs.kind);
        const content = document.createElement(inline ? 'span' : 'div');
        if (math) {
          const value = node.attrs.raw.replace(/^\$\$?\s*|\s*\$\$?$/g, '');
          content.innerHTML = katex.renderToString(value, { displayMode: !inline, throwOnError: false, trust: false });
        } else {
          const label = document.createElement('small'); label.textContent = node.attrs.kind === 'mdxjsEsm' ? '组件导入' : 'MDX / 源码'; dom.append(label);
          content.textContent = node.attrs.raw;
        }
        dom.append(content);
        const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '编辑'; edit.setAttribute('aria-label', math ? '编辑公式源码' : '编辑组件源码');
        edit.onclick = () => editor.options.onEditRaw?.(node.attrs.raw, value => {
          const pos = getPos(); if (typeof pos !== 'number') return;
          editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...node.attrs, raw: value }); return true; }).run();
        });
        dom.append(edit); return { dom };
      };
    },
  });
}
const SafeImage = Image.extend({
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('img');
      const src = node.attrs.src || '';
      if (!/^(?:https?:|data:|\/\/)/i.test(src)) {
        const id = editor.options.documentId;
        const folder = id.startsWith('thought') ? '_thoughts' : '_posts';
        const stem = id.split('/')[1].replace(/\.mdx?$/, '');
        dom.src = src.startsWith('/') ? (/^\/_(posts|thoughts)\//.test(src) ? src : '/site' + src) : `/${folder}/${encodeURIComponent(stem)}/${src}`;
      } else { dom.alt = '远程图片：' + src; }
      dom.alt ||= node.attrs.alt || '图片'; dom.title = node.attrs.title || ''; return { dom };
    };
  },
});
const extensions = [StarterKit.configure({ link: { openOnClick: false, autolink: false } }), SafeImage, TableKit, TaskList, TaskItem.configure({ nested: true }), rawNode(false), rawNode(true), Markdown];
export const manager = new MarkdownManager({ extensions });
export function parsePrepared(prepared) {
  const parts = new Map(prepared.fragments.map(x => [x.token, x]));
  const json = manager.parse(prepared.markdown);
  function walk(node) {
    const block = node.type === 'codeBlock' && parts.get(node.attrs?.language);
    if (block) return { type: 'rawBlock', attrs: { raw: block.raw, kind: block.kind } };
    if (node.type === 'text') {
      const matches = [...node.text.matchAll(/tidemark[a-f0-9]{32}x\d+/g)].filter(m => parts.has(m[0]));
      if (!matches.length) return node;
      const out = []; let pos = 0;
      for (const match of matches) {
        if (match.index > pos) out.push({ ...node, text: node.text.slice(pos, match.index) });
        const p = parts.get(match[0]); out.push({ type: 'rawInline', attrs: { raw: p.raw, kind: p.kind }, ...(node.marks ? { marks: node.marks } : {}) }); pos = match.index + match[0].length;
      }
      if (pos < node.text.length) out.push({ ...node, text: node.text.slice(pos) });
      return out;
    }
    if (node.content) node.content = node.content.flatMap(walk);
    return node;
  }
  return walk(json);
}
export function createRich(element, prepared, options) {
  return new Editor({ element, extensions, content: parsePrepared(prepared), ...options, editorProps: {
    attributes: { class: 'rich-document', role: 'textbox', 'aria-label': '富文本正文', 'aria-multiline': 'true' },
    ...options.editorProps,
  } });
}
export function markdownPosition(editor) {
  const token = 'TIDEMARKCARET' + crypto.randomUUID().replaceAll('-', '');
  const transaction = editor.state.tr.insertText(token, editor.state.selection.from);
  const text = manager.serialize(transaction.doc.toJSON());
  const pos = text.indexOf(token);
  return pos < 0 ? editor.getMarkdown().length : pos;
}
