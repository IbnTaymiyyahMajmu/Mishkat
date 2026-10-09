/**
 * Checks that every language says the same sentences as the English.
 *
 * The compiler already holds each language's file to the English one key for
 * key (`Messages`, in src/lib/i18n/types.ts), so a sentence cannot be left
 * out. What it cannot see is inside the strings: a `{count}` dropped while a
 * translation was being corrected is still a string, and would be printed to
 * the reader as it stands. This reads what is inside.
 *
 *   node scripts/check-messages.mjs      (npm run check:messages)
 *
 * For each sentence it compares, against the English:
 *
 *   {values}   the same ones must be named — though not in the same order,
 *              which is a language's own business;
 *   <marks>    the same stretches must be marked for the screen to set;
 *   plurals    a sentence that changes with a number in English must be
 *              written per form in every language.
 *
 * It is the thing to run after a native speaker has been through a file.
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = new URL("../src/lib/i18n/messages/", import.meta.url);

/** The sentences of one language, by key, as they are written in its file. */
function read(lang) {
  // What comes after the messages is what the language says about the works of
  // tafsir, which is keyed by work and is not held to the English.
  const text = readFileSync(new URL(`${lang}.ts`, DIR), "utf8").split("export const tafsirWords")[0];
  const out = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const entry = /^  "([^"]+)":\s*(.*)$/.exec(lines[i]);
    if (!entry) continue;
    // The value is on this line, or on the next where it was too long for one.
    out[entry[1]] = entry[2].trim() ? entry[2] : (lines[++i] ?? "").trim();
  }
  return out;
}

const values = (s) => [...new Set(s.match(/\{(\w+)\}/g) ?? [])].sort().join(" ");
const marks = (s) => [...new Set(s.match(/<\/?\w+>/g) ?? [])].sort().join(" ");
const plural = (s) => /^\{\s*(zero|one|two|few|many|other):/.test(s);

const english = read("en");
const others = readdirSync(DIR)
  .filter((name) => name.endsWith(".ts") && name !== "en.ts")
  .map((name) => name.slice(0, -3))
  .sort();

console.log(`en: ${Object.keys(english).length} sentences`);

let wrong = 0;
for (const lang of others) {
  const said = read(lang);
  const found = [];
  for (const [key, source] of Object.entries(english)) {
    const theirs = said[key];
    if (theirs === undefined) {
      found.push(`${key}: not said`);
      continue;
    }
    if (values(source) !== values(theirs)) {
      found.push(`${key}: the English names ${values(source) || "nothing"}, this names ${values(theirs) || "nothing"}`);
    }
    if (marks(source) !== marks(theirs)) {
      found.push(`${key}: the English marks ${marks(source) || "nothing"}, this marks ${marks(theirs) || "nothing"}`);
    }
    if (plural(source) !== plural(theirs)) found.push(`${key}: a plural in one and a sentence in the other`);
  }
  for (const key of Object.keys(said)) if (!(key in english)) found.push(`${key}: not in the English`);

  console.log(`${lang}: ${Object.keys(said).length} sentences${found.length ? `, ${found.length} to put right` : ", all in step"}`);
  for (const line of found) console.log(`   ${line}`);
  wrong += found.length;
}

process.exit(wrong ? 1 : 0);
