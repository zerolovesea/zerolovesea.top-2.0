import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';

// Model images become links so a reply cannot silently fetch a remote tracking image.
function replyImages() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (node.type === 'image' || node.type === 'imageReference') {
        node.type = node.type === 'image' ? 'link' : 'linkReference'; node.children = [{ type: 'text', value: node.alt || '图片' }];
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}
const renderer = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(replyImages)
  .use(remarkRehype)
  .use(rehypeSanitize, { ...defaultSchema, attributes: { ...defaultSchema.attributes, code: [['className', /^language-./, 'math-inline', 'math-display']] } })
  .use(rehypeKatex, { throwOnError: false, trust: false })
  .use(() => (tree: any) => {
    const walk = (node: any) => {
      if (node.tagName === 'a') Object.assign(node.properties, { target: '_blank', rel: ['noopener', 'noreferrer'] });
      node.children?.forEach(walk);
    };
    walk(tree);
  }).use(rehypeStringify);
export async function renderReply(markdown: string) { return String(await renderer.process(markdown)); }
