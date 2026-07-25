type Node = {
	type?: string;
	url?: unknown;
	children?: Node[];
};

function postDirectory(path?: string) {
	return path?.match(
		/[/\\]src[/\\]content[/\\]writing(?:-en)?[/\\]([^/\\]+)\.(?:md|mdx)$/,
	)?.[1];
}

function rewriteImagePaths(node: Node, directory: string) {
	if (
		node.type === "image" &&
		typeof node.url === "string" &&
		!node.url.includes("/") &&
		!node.url.startsWith("#") &&
		!/^[a-z][a-z\d+.-]*:/i.test(node.url)
	) {
		node.url = `/_posts/${encodeURIComponent(directory)}/${encodeURIComponent(
			node.url,
		)}`;
	}
	node.children?.forEach((child) => rewriteImagePaths(child, directory));
}

export default function remarkPostImagePaths() {
	return (tree: Node, file: { path?: string }) => {
		const directory = postDirectory(file.path);
		if (directory) rewriteImagePaths(tree, directory);
	};
}
