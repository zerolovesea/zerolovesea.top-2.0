import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, cp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir, getPriority } from 'node:os';
import { resolve } from 'node:path';
import { ContentStore, serialize } from './content';
import { Preview } from './preview';

test('isolated Astro preview renders MDX, KaTeX and shared image navigation without saving draft', async () => {
  const project = resolve(import.meta.dir, '../..');
  const root = await mkdtemp(resolve(tmpdir(), 'studio-preview-test-'));
  const preview = new Preview(new ContentStore(root), 4397);
  try {
    await cp(resolve(project, 'src'), resolve(root, 'src'), { recursive: true, filter: source => !source.startsWith(resolve(project, 'src/content') + '/') && source !== resolve(project, 'src/content') });
    await mkdir(resolve(root, 'src/content/writing'), { recursive: true });
    await mkdir(resolve(root, 'public/_posts/test'), { recursive: true });
    await symlink(resolve(project, 'node_modules'), resolve(root, 'node_modules'));
    for (const name of ['package.json', 'tsconfig.json', 'astro.config.mjs', 'tailwind.config.mjs']) await cp(resolve(project, name), resolve(root, name));
    const doc = { id: 'writing/test.mdx', meta: { title: 'isolated preview', description: 'fixture', pubDate: '2026-10-22' }, body: 'import { Highlight, DecisionForm, AgentSimulation, EnergyMeter } from "@components/interactive";\n\n<Highlight>component works</Highlight>\n\n$$\n\\frac{a}{b} \\in \\mathbb{R}\n$$\n\n![one](/_posts/test/a.png)\n\n![two](/_posts/test/b.png)\n\n<DecisionForm />\n\n<DecisionForm />\n\n<AgentSimulation />\n\n<AgentSimulation />\n\n<EnergyMeter />\n\n<EnergyMeter />' };
    const original = serialize({ ...doc.meta, title: 'original source' }, 'original body');
    await writeFile(resolve(root, 'src/content/writing/test.mdx'), original);
    await mkdir(resolve(root, 'src/content/writing-en'), { recursive: true });
    await writeFile(resolve(root, 'src/content/writing-en/test.md'), serialize({ ...doc.meta, title: 'English counterpart' }, '![shared](/_posts/test/a.png)'));
    const gallery = await preview.components();
    const highlight = await fetch(gallery.url + '?component=Highlight&text=preview-works&color=green');
    expect(highlight.status).toBe(200);
    expect(await highlight.text()).toContain('bg-green-200');
    const form = await fetch(gallery.url + '?component=DecisionForm');
    expect(await form.text()).toContain('data-trace');
    const result = await preview.prepare(doc);
    const response = await fetch(result.url);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('component works');
    expect(html).toContain('katex');
    expect(html).toContain('data-previous');
    expect(html).toContain('/_posts/test/a.png');
    const ids = [...html.matchAll(/(?<![\w-])id="([^"]+)"/g)].map(match => match[1]);
    expect(ids.length).toBe(new Set(ids).size);
    const english = await fetch(result.url.replace('/_studio-preview', '/en/_studio-preview'));
    expect(english.status).toBe(200);
    expect(await english.text()).toContain('/_posts/test/a.png');
    expect(await readFile(resolve(root, 'src/content/writing/test.mdx'), 'utf8')).toBe(original);
    const child = preview.child!;
    expect(getPriority(child.pid)).toBeGreaterThanOrEqual(10);
    await preview.pause();
    expect(preview.child).toBeNull();
    await expect(fetch(result.url)).rejects.toThrow();
    const resumed = await preview.prepare(doc);
    expect((await fetch(resumed.url)).status).toBe(200);

  } finally { preview.stop(); if (preview.child) await preview.child.exited; await rm(root, { recursive: true, force: true }); }
}, 90_000);
