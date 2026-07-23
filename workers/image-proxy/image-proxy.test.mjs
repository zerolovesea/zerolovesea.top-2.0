import { expect, test } from "bun:test";
import worker from "./src/index.js";

test("rejects an image host outside the allowlist", async () => {
	const response = await worker.fetch(
		new Request("https://example.workers.dev/?url=https%3A%2F%2Fexample.com%2Fimage.png"),
	);
	expect(response.status).toBe(403);
});
