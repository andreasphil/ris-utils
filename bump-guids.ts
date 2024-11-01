const [filePath] = Deno.args;
let file = Deno.readTextFileSync(filePath);
let count = 0;

file = file.replace(/GUID="[a-f0-9-]*"/g, () => {
  count++;
  return `GUID="${crypto.randomUUID()}"`;
});

Deno.writeTextFileSync(filePath, file);
console.log(`✅ Updated ${count} GUIDs in ${filePath}`);
