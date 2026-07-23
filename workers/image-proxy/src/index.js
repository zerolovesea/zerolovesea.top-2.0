const allowedHosts = new Set([
	"arthurchiao.art",
	"baoyu.io",
	"hub-cache.baai.ac.cn",
	"i-blog.csdnimg.cn",
	"img2024.cnblogs.com",
	"miro.medium.com",
	"pic1.zhimg.com",
	"pic2.zhimg.com",
	"pic4.zhimg.com",
	"picx.zhimg.com",
	"static001.geekbang.org",
	"tracholar.github.io",
	"www.autodl.com",
]);

export default {
	async fetch(request) {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const source = new URL(request.url).searchParams.get("url");
		let target;
		try {
			target = new URL(source);
		} catch {
			return new Response("Invalid image URL", { status: 400 });
		}

		if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
			return new Response("Image host is not allowed", { status: 403 });
		}

		const upstream = await fetch(target, {
			headers: { Accept: request.headers.get("Accept") ?? "image/*,*/*;q=0.8" },
		});
		const contentType = upstream.headers.get("Content-Type");
		if (!upstream.ok || !contentType?.startsWith("image/")) {
			return new Response("Image unavailable", { status: 502 });
		}

		const headers = new Headers(upstream.headers);
		headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
		headers.set("X-Content-Type-Options", "nosniff");
		return new Response(request.method === "HEAD" ? null : upstream.body, {
			status: upstream.status,
			headers,
		});
	},
};
