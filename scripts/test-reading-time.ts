import { getReadingTime } from "../src/utils/index";

if (getReadingTime("中".repeat(400)) !== 1) throw new Error("Chinese reading time is incorrect.");
if (getReadingTime("word ".repeat(201)) !== 2) throw new Error("English reading time is incorrect.");
