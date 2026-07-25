import { access, mkdir, writeFile } from "node:fs/promises";
import { thoughtCategoryTranslations } from "../src/data/thought-categories";

const args = process.argv.slice(2);
const rawCommand = args.shift() ?? "";
const command = rawCommand.startsWith("post:")
	? "post:"
	: rawCommand.startsWith("thought:")
		? "thought:"
		: rawCommand;
const isPost = command === "post:";
const isThought = command === "thought" || command === "thought:";

if (!isPost && !isThought) {
	console.log(
		'Usage: bun new post: "Post title"\n       bun new thought: "Thought content" [--category "Category"]',
	);
	process.exit(command === "--help" ? 0 : 1);
}

let category = "随笔";
if (isThought) {
	const categoryIndex = args.indexOf("--category");
	if (categoryIndex !== -1) {
		category = args[categoryIndex + 1]?.trim() ?? "";
		args.splice(categoryIndex, 2);
		if (!category) throw new Error('Usage: --category "Category"');
	}
}

const title = [rawCommand.slice(command.length), ...args].join(" ").trim();
if (isPost && !title) throw new Error('Usage: bun new post: "Post title"');
if (isThought && !title)
	throw new Error('Usage: bun new thought: "Thought content"');

const postFileName = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim();
if (isPost && !postFileName)
	throw new Error("Post title must contain a valid filename character.");

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

const thoughtDate = `${parts.year}-${parts.month}-${parts.day}-${parts.hour}-${parts.minute}`;
const fileName = isThought ? thoughtDate : postFileName;
const collections = isThought
	? ["thought", "thought-en"]
	: ["writing", "writing-en"];
const englishCategory = thoughtCategoryTranslations[category] ?? category;
const contents = collections.map((collection) =>
	isThought
		? `---\ntitle: "${
				collection === "thought" ? "随笔" : "note"
			} · ${pubDate.slice(0, -3)}"\ndescription: ${JSON.stringify(
				title,
			)}\ncategory: ${JSON.stringify(
				collection === "thought" ? category : englishCategory,
			)}\npubDate: "${pubDate}"\n---\n\n${title}\n`
		: `---\ntitle: "${title
				.replaceAll("\\", "\\\\")
				.replaceAll(
					'"',
					'\\"',
				)}"\ndescription: ""\npubDate: "${pubDate}"\n---\n\n`,
);
const destinations = collections.map(
	(collection) =>
		new URL(`../src/content/${collection}/${fileName}.md`, import.meta.url),
);

await Promise.all(
	collections.map((collection) =>
		mkdir(new URL(`../src/content/${collection}/`, import.meta.url), {
			recursive: true,
		}),
	),
);

await Promise.all(
	destinations.map(async (destination) => {
		try {
			await access(destination);
		} catch (error) {
			if (
				typeof error === "object" &&
				error &&
				"code" in error &&
				error.code === "ENOENT"
			)
				return;
			throw error;
		}
		throw new Error(`Post already exists: ${fileName}.md`);
	}),
);
await Promise.all(
	destinations.map((destination, index) =>
		writeFile(destination, contents[index], { flag: "wx" }),
	),
);

if (isPost) {
	await mkdir(new URL(`../public/_posts/${fileName}/`, import.meta.url), {
		recursive: true,
	});
}

console.log(`Created ${collections.join(" and ")} content for ${fileName}`);
