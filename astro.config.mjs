import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeImageProxy from "./src/utils/rehype-image-proxy";

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
			remarkPlugins: [remarkMath],
			rehypePlugins: [rehypeKatex, rehypeImageProxy],
		}),
	},
	output: "static",
});
