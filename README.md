## 📖 about project
this project is forked from [sanju.sh](https://github.com/Spikeysanju/sanju.sh).


## ✨ features
- **writings**: a collection of my blog posts and articles
- **thoughts**: a place for me to share my random thoughts and ideas (more like tweets or quotes)
- **dynamic og images**: auto-generated per post using svg + resvg-wasm on the edge
- **self-hosted fonts**: uncut sans, four weights, woff2 + woff fallback

## 🛠️ tech stack
- **astro**: content-focused web framework with ssr on cloudflare workers
- **tailwindcss**: utility-first css framework for rapid prototyping
- **markdown**: for writing content in a simple and easy-to-read format
- **typescript**: for type-checking and better code quality
- **biome**: Format, lint, and more in a fraction of a second.
- **cloudflare workers**: hosts the production site with static assets and server rendering

## 🎨 design
- i wanted to keep the design simple and clean. i used a monochrome color scheme with a pop of color for the accent.
- i also used a lot of whitespace to make the content easy to read and navigate.
- i'm a big fan of minimalism and KISS (keep it simple, stupid) and i think it works well for a personal website like this.
- i hope you like the design as much as i do!

## 🚀 deployment
the site is deployed as a cloudflare worker named `sanju`.

```bash
bun run build
bunx wrangler deploy --name sanju
```

the astro cloudflare adapter writes a worker bundle to `dist/server` and static assets to `dist/client`. `wrangler.jsonc` points at the cloudflare adapter entrypoint, and wrangler follows the generated `dist/server/wrangler.json` during deploy.

the old cloudflare pages projects were removed after the astro 7 migration. use workers for production deploys going forward.

## 🤝 contributing
if you have ideas or suggestions, feel free to open an issue or submit a pull request. i'm open to collaborations and contributions.

## 📬 contact
you can reach me at work@sanju.sh or on twitter. don't hesitate to get in touch!

## 📜 license
this project is open source under the Apache License 2.0. you're welcome to use the code for your own projects. if you do, a shoutout would be appreciated but it's not required.
