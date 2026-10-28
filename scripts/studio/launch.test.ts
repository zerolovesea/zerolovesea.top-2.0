import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { launchHTML } from './macos/launch';

test('startup bundles the approved vector and motion without external resources', async () => {
  const html = await launchHTML();
  const svg = await readFile(new URL('../../design/logo-motion/logo.svg', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../design/logo-motion/motion.css', import.meta.url), 'utf8');
  expect(html).toContain(svg);
  expect(html).toContain(css);
  expect(html).toContain('data-reduced="false"');
  expect(html).toContain('prefers-reduced-motion:reduce');
  expect(html).toContain("default-src 'none'");
  expect(html).not.toMatch(/<(script|img|iframe|link)\b|\b(src|href)=/i);
  expect(html).not.toContain('infinite');
});
