import assert from "node:assert/strict";
import worker from "./worker.mjs";

const env = { ASSETS: { fetch: () => new Response("asset") } };
const redirected = await worker.fetch(new Request("https://www.zerolovesea.top/writings?q=1"), env);
assert.equal(redirected.status, 301);
assert.equal(redirected.headers.get("location"), "https://zerolovesea.top/writings?q=1");
assert.equal(await (await worker.fetch(new Request("https://zerolovesea.top/"), env)).text(), "asset");
