import { test, expect } from 'bun:test';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createStudio } from '../studio-server';
import { defaultConfig } from './translate';

test('saved model key survives restart, remains private, and can be replaced or cleared', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'tidemark-settings-'));
  const originalFetch = globalThis.fetch;
  const originalEnvironmentKey = process.env.STUDIO_LLM_API_KEY;
  delete process.env.STUDIO_LLM_API_KEY;
  const credential = 'fixture-persisted-key';
  let sentKey = '';
  globalThis.fetch = (async (_url, init) => {
    sentKey = (init?.headers as Record<string, string>)['x-api-key'];
    return Response.json({ model: 'fixture', content: [{ type: 'text', text: 'CONNECTION_OK' }] });
  }) as typeof fetch;
  let app = await createStudio(root, { key: '' });
  const request = async (route: string, data?: unknown) => {
    const response = await app.fetch(new Request(`http://127.0.0.1:4322/api/${route}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'x-studio-token': app.token, ...(data === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain(credential);
    expect(body).not.toHaveProperty('key');
    return body;
  };
  const restart = async () => { app.close(); app = await createStudio(root, { key: '' }); };
  try {
    expect((await request('settings', { ...defaultConfig, key: credential })).hasKey).toBe(true);
    expect((await stat(resolve(root, '.local-studio/model.json'))).mode & 0o777).toBe(0o600);
    await restart();
    expect((await request('init')).config.hasKey).toBe(true);
    expect((await request('init')).config).not.toHaveProperty('key');
    await request('test-model', {});
    expect(sentKey).toBe(credential);
    await request('settings', { ...defaultConfig, model: 'changed-model', key: '' });
    await restart();
    await request('test-model', {});
    expect(sentKey).toBe(credential);
    await request('settings', { ...defaultConfig, key: 'replacement-key' });
    await restart();
    await request('test-model', {});
    expect(sentKey).toBe('replacement-key');
    await request('settings', { ...defaultConfig, clearKey: true });
    await restart();
    expect((await request('init')).config.hasKey).toBe(false);
    expect(JSON.parse(await readFile(resolve(root, '.local-studio/model.json'), 'utf8')).key).toBe('');
    await request('settings', { ...defaultConfig, key: credential });
    expect((await request('settings', { ...defaultConfig, endpoint: 'https://another-provider.invalid', key: '' })).hasKey).toBe(false);
    await restart();
    expect((await request('init')).config.hasKey).toBe(false);
  } finally {
    app.close(); globalThis.fetch = originalFetch;
    if (originalEnvironmentKey === undefined) delete process.env.STUDIO_LLM_API_KEY;
    else process.env.STUDIO_LLM_API_KEY = originalEnvironmentKey;
    await rm(root, { recursive: true, force: true });
  }
});
