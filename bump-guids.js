import { argv } from "node:process";
import { readFileSync, writeFileSync } from "node:fs";

const [filePath] = argv.slice(2)
let file = readFileSync(filePath, "utf8");
let count = 0;

file = file.replace(/GUID="[a-f0-9-]*"/g, () => {
  count++;
  return `GUID="${crypto.randomUUID()}"`;
});

writeFileSync(filePath, file, { encoding: "utf8" });
console.log(`✅ Updated ${count} GUIDs in ${filePath}`);
