type Node = {
	type?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: Node[];
	value?: unknown;
};

function paragraphImages(node?: Node) {
	if (!node) return;
	const children = node.children?.filter(
		(child) => child.type !== "text" || child.value?.toString().trim(),
	);
	return node.type === "element" &&
		node.tagName === "p" &&
		children?.length &&
		children.every(
			(child) => child.type === "element" && child.tagName === "img",
		)
		? children
		: undefined;
}

function gallery(images: Node[]): Node {
	return {
		type: "element",
		tagName: "div",
		properties: { className: ["image-gallery"] },
		children: images.map((image) => ({
			type: "element",
			tagName: "a",
			properties: { href: image.properties?.src },
			children: [image],
		})),
	};
}

function isWhitespace(node: Node) {
	return node.type === "text" && !node.value?.toString().trim();
}

function groupImages(node: Node) {
	node.children?.forEach(groupImages);
	if (!node.children) return;

	const children: Node[] = [];
	for (let index = 0; index < node.children.length; index++) {
		const images = paragraphImages(node.children[index]);
		if (!images) {
			children.push(node.children[index]);
			continue;
		}

		const grouped = [...images];
		let end = index + 1;
		while (end < node.children.length) {
			while (end < node.children.length && isWhitespace(node.children[end]))
				end++;
			if (end === node.children.length) break;
			const nextImages = paragraphImages(node.children[end]);
			if (!nextImages) break;
			grouped.push(...nextImages);
			end++;
		}

		children.push(grouped.length > 1 ? gallery(grouped) : node.children[index]);
		index = end - 1;
	}
	node.children = children;
}

export default function rehypeImageGallery() {
	return (tree: Node) => groupImages(tree);
}
