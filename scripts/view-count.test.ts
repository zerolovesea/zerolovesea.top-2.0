import { test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';

const source = (await Bun.file(new URL('../src/components/misc/view-count.astro', import.meta.url)).text()).split('<script>')[1].split('</script>')[0];
const script = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
async function display(responses: Array<Response | Error>, { blockedStorage = false, optOut = false } = {}) {
  const element = { textContent: '… reads', setAttribute() {} };
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const storage = new Map(optOut ? [['view_optout', '1']] : []);
  await runInNewContext(script, {
    document: { querySelector: () => element, cookie: '' },
    window: { location: { search: '', pathname: '/en/测试文章/' } },
    localStorage: {
      getItem(key: string) { if (blockedStorage) throw new Error('storage blocked'); return storage.get(key) ?? null; },
      setItem(key: string, value: string) { storage.set(key, value); },
    },
    URLSearchParams, URL, AbortSignal, crypto,
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method || 'GET', body: init.body as string });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (!response) throw new Error('unexpected request');
      return response;
    },
  });
  return { text: element.textContent, calls };
}

test('counts once and shares the Chinese slug for the English article', async () => {
  const result = await display([Response.json({ count: 53 })]);
  expect(result.text).toBe('53 reads');
  expect(result.calls).toHaveLength(1);
  expect(JSON.parse(result.calls[0].body!).slug).toBe('测试文章');
  expect(result.calls[0].method).toBe('POST');
});
test('failed increment falls back to a read without counting twice', async () => {
  const result = await display([new Error('network'), Response.json({ count: 53 })]);
  expect(result.text).toBe('53 reads');
  expect(result.calls.map(call => call.method)).toEqual(['POST', 'GET']);
});
test('opt-out and blocked storage still display the count without incrementing', async () => {
  for (const options of [{ optOut: true }, { blockedStorage: true }]) {
    const result = await display([Response.json({ count: 53 })], options);
    expect(result.text).toBe('53 reads');
    expect(result.calls.map(call => call.method)).toEqual(['GET']);
  }
});
test('HTTP errors, invalid JSON data and timeouts do not leave an ellipsis or invent zero', async () => {
  for (const failure of [new Error('timeout'), Response.json({}, { status: 500 }), Response.json({ error: 'failed' }), new Response('<html>error</html>')]) {
    const result = await display([failure, new Error('unavailable')]);
    expect(result.text).toBe('reads unavailable');
  }
});
