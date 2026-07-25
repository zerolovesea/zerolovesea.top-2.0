import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const [posts, englishPosts] = await Promise.all([
		getCollection("writing"),
		getCollection("writingEn"),
	]);
	const entries = [
		...posts.map((post) => ({ post, path: `/${post.id}` })),
		...englishPosts.map((post) => ({ post, path: `/en/${post.id}` })),
	];

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	${entries
		.map(
			({ post, path }) => `<url>
    <loc>${new URL(path, import.meta.env.SITE).href}</loc>
    <lastmod>${(post.data.updatedDate ?? post.data.pubDate).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
		)
		.join("\n  ")}
</urlset>`;

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};
