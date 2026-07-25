import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeImageGallery from "./src/utils/rehype-image-gallery";
import rehypeImageProxy from "./src/utils/rehype-image-proxy";
import remarkPostImagePaths from "./src/utils/remark-post-image-paths";

// https://astro.build/config
export default defineConfig({
	site: "https://zerolovesea.top",
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			exclude: ["astro/compiler-runtime"],
		},
		ssr: {
			optimizeDeps: {
				exclude: ["astro/compiler-runtime"],
			},
		},
	},
	integrations: [mdx()],
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath, remarkPostImagePaths],
			rehypePlugins: [rehypeKatex, rehypeImageProxy, rehypeImageGallery],
		}),
	},
	output: "static",
});
