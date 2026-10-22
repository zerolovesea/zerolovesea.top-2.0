import { resolve, sep } from "node:path";

const root = import.meta.dir;
const publicRoot = resolve(root, "../../public");

export async function respond(request) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("read-only design prototype", { status: 405 });
	}
	let path;
	try {
		path = decodeURIComponent(new URL(request.url).pathname);
	} catch {
		return new Response("invalid path", { status: 400 });
	}
	const assets = path.startsWith("/site/");
	const base = assets ? publicRoot : root;
	const filePath = resolve(base, assets ? path.slice(6) : `.${path === "/" ? "/index.html" : path}`);
	if (!filePath.startsWith(base + sep) || (!assets && !/\.(html|css|js|png)$/.test(filePath))) {
		return new Response("not found", { status: 404 });
	}
	const file = Bun.file(filePath);
	if (!(await file.exists())) return new Response("not found", { status: 404 });
	return new Response(request.method === "HEAD" ? null : file, {
		headers: { "Content-Type": file.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

if (import.meta.main) {
	const server = Bun.serve({ hostname: "127.0.0.1", port: 4322, fetch: respond });
	console.log(`local studio · design prototype · ${server.url}`);
}
