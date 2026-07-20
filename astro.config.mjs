import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
		server: {
			allowedHosts: ["frederick-east-surfing-beam.trycloudflare.com"],
		},
	},
	integrations: [mdx()],
	markdown: {
		processor: unified({
			remarkPlugins: [remarkMath],
			rehypePlugins: [rehypeKatex],
		}),
	},
	output: "server",
	adapter: cloudflare(),
});
