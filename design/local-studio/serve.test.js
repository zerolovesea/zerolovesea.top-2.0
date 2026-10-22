import { describe, expect, test } from "bun:test";
import { respond } from "./serve.mjs";

describe("read-only local design server", () => {
  test("serves prototype and existing font assets", async () => {
    const index = await respond(new Request("http://localhost/"));
    expect(index.status).toBe(200);
    expect(await index.text()).toContain('id="main"');
    const font = await respond(new Request("http://localhost/site/fonts/uncut/woff2/UncutSans-Regular.woff2"));
    expect(font.status).toBe(200);
  });

  test("rejects writes, malformed URLs, source files and traversal", async () => {
    expect((await respond(new Request("http://localhost/", {method:"POST"}))).status).toBe(405);
    for (const path of ["/%ZZ", "/serve.mjs", "/site/%2e%2e%2fpackage.json", "/site/%2f..%2fpackage.json", "/missing.css"]) {
      expect((await respond(new Request("http://localhost" + path))).status).toBeGreaterThanOrEqual(400);
    }
  });
});
