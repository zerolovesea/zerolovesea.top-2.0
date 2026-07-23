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

type Node = {
	type?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: Node[];
};

function proxyImages(node: Node) {
	if (node.type === "element" && node.tagName === "img") {
		const src = node.properties?.src;
		if (typeof src === "string") {
			try {
				if (allowedHosts.has(new URL(src).hostname)) {
					node.properties = {
						...node.properties,
						src: `/cdn/image/?url=${encodeURIComponent(src)}`,
					};
				}
			} catch {}
		}
	}
	node.children?.forEach(proxyImages);
}

export default function rehypeImageProxy() {
	return (tree: Node) => proxyImages(tree);
}
