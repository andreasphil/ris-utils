import kleur from "npm:kleur";

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function findAll(substr: string, value: string): [number, number][] {
  const result: [number, number][] = [];
  let position: number = 0;

  while (position < value.length) {
    const index = value.indexOf(substr, position);
    if (index >= 0) {
      result.push([index, index + substr.length]);
      position = index + substr.length;
    } else break;
  }

  return result;
}

function printRanges(ranges: [number, number][]): string {
  return ranges.map(([from, to]) => `${from}-${to}`).join(", ");
}

function printResult(value: string, ranges: [number, number][]): string {
  let result = "";
  let cursor = 0;

  // Assumes that ranges are sorted and don't overlap
  for (const [from, to] of ranges) {
    result += value.substring(cursor, from);
    result += kleur.bgYellow(value.substring(from, to));
    cursor = to;
  }

  result += value.substring(cursor);

  return result;
}

let [searchStr, input] = Deno.args;
if (!searchStr || !input) {
  console.error(kleur.red("Search string and text can't be empty!"));
  console.log("Usage: char-count-ignoring-whitespace.ts <search> <text>");
  Deno.exit(1);
}

input = normalizeWhitespace(input);
searchStr = normalizeWhitespace(searchStr);
const ranges = findAll(searchStr, input);

console.log(`${kleur.bold().cyan("Searching for:")} "${searchStr}"`);
console.log(`${kleur.bold().cyan("In:")} "${input}"`);

if (ranges.length) {
  console.log(`${kleur.bold().cyan("Found ranges:")} ${printRanges(ranges)}`);
  console.log("");
  console.log(printResult(input, ranges));
} else {
  console.log(kleur.red("No matches found"));
}
