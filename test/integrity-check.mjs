// One-off integrity check: style ids unique, every labelKey/descKey present in zh+en.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

const ids = [...src.matchAll(/id: "([a-z0-9-]+)",\n\s+category: "([a-z]+)",/g)].map((m) => m[1]);
const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
console.log("style count:", ids.length, dups.length ? "DUPLICATES: " + dups : "(ids unique)");

const zhBlock = src.match(/var zh = \{([\s\S]*?)\n    \};/);
const enBlock = src.match(/var en = \{([\s\S]*?)\n    \};/);
if (!zhBlock || !enBlock) { console.error("could not locate zh/en dicts"); process.exit(1); }
const zhKeys = new Set([...zhBlock[1].matchAll(/"([a-zA-Z0-9.]+)":/g)].map((m) => m[1]));
const enKeys = new Set([...enBlock[1].matchAll(/"([a-zA-Z0-9.]+)":/g)].map((m) => m[1]));

const labelKeys = [...src.matchAll(/labelKey: "([^"]+)"/g)].map((m) => m[1]);
const descKeys = [...src.matchAll(/descKey: "([^"]+)"/g)].map((m) => m[1]);
const missing = [...new Set([...labelKeys, ...descKeys])].filter((k) => !zhKeys.has(k) || !enKeys.has(k));
console.log("locale:", labelKeys.length, "labels /", descKeys.length, "descs; missing in zh/en:",
  missing.length ? missing : "none");

const cats = [...src.matchAll(/category: "([a-z]+)"/g)].map((m) => m[1]);
const byCat = {};
for (const c of cats) byCat[c] = (byCat[c] || 0) + 1;
console.log("by category:", JSON.stringify(byCat));

// Every style category must have a first-layer entry in CATEGORIES, else its
// themes register but are unreachable from the picker.
const catListBlock = src.match(/var CATEGORIES = \[([\s\S]*?)\n\s*\];/);
if (!catListBlock) { console.error("could not locate CATEGORIES"); process.exit(1); }
const catList = [...catListBlock[1].matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]);
const orphanCats = [...new Set(cats)].filter((c) => !catList.includes(c));
console.log("CATEGORIES entries:", JSON.stringify(catList));
console.log("style categories missing from CATEGORIES:",
  orphanCats.length ? orphanCats : "none");
if (orphanCats.length) process.exit(1);
