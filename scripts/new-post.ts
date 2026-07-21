import { mkdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
if (args[0] === "post:") args.shift();
const title = args.join(" ").trim();

if (!title || title === "--help") {
	console.log('Usage: bun new post: "Post title"');
	process.exit(title ? 0 : 1);
}

const fileName = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
if (!fileName) throw new Error("Post title must contain a valid filename character.");

const parts = Object.fromEntries(
	new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	})
		.formatToParts(new Date())
		.filter((part) => part.type !== "literal")
		.map((part) => [part.type, part.value]),
);
const pubDate = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
const destination = new URL(`../src/content/writing/${fileName}.md`, import.meta.url);

await mkdir(new URL("../src/content/writing/", import.meta.url), { recursive: true });
try {
	await writeFile(
		destination,
		`---\ntitle: "${title.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"\ndescription: ""\npubDate: "${pubDate}"\n---\n\n`,
		{ flag: "wx" },
	);
} catch (error) {
	if (typeof error === "object" && error && "code" in error && error.code === "EEXIST") {
		throw new Error(`Post already exists: ${fileName}.md`);
	}
	throw error;
}

console.log(`Created src/content/writing/${fileName}.md`);
