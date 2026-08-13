/** Compact ESLint report: file, line and rule only. `node scripts/lint-summary.mjs` */
import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2] ?? "lint.json", "utf8"));
let errors = 0;
let warnings = 0;

for (const file of report) {
  if (!file.messages.length) continue;
  console.log(file.filePath.split(/[\\/]src[\\/]/)[1] ?? file.filePath);
  for (const m of file.messages) {
    if (m.severity === 2) errors++;
    else warnings++;
    console.log(`   ${m.line}:${m.column}  ${m.severity === 2 ? "error" : "warn "}  ${m.ruleId}`);
  }
}
console.log(`\n${errors} errors, ${warnings} warnings`);
