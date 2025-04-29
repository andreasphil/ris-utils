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

function printResult(value: string, ranges: [number, number][]): string[] {
  let result = "";
  const format = [];
  let cursor = 0;

  // Assumes that ranges are sorted and don't overlap
  for (const [from, to] of ranges) {
    result += value.substring(cursor, from);
    result += `%c${value.substring(from, to)}%c`;
    format.push("background-color: yellow; color: black", "");
    cursor = to;
  }

  result += value.substring(cursor);

  return [result, ...format];
}

let [searchStr, input] = Deno.args;
if (!searchStr || !input) {
  console.error("%cSearch string and text can't be empty!", "color: red");
  console.log("Usage: char-count-ignoring-whitespace.ts <search> <text>");
  Deno.exit(1);
}

input = normalizeWhitespace(input);
searchStr = normalizeWhitespace(searchStr);
const ranges = findAll(searchStr, input);

console.log(
  `%cSearching for:%c "${searchStr}"`,
  "color: cyan; font-weight: bold",
  ""
);

console.log(`%cIn:%c "${input}"`, "color: cyan; font-weight: bold", "");

if (ranges.length) {
  console.log(
    `%cFound ranges:%c ${printRanges(ranges)}`,
    "color: cyan; font-weight: bold",
    ""
  );

  console.log("");
  console.log(...printResult(input, ranges));
} else {
  console.log("%cNo matches found", "color: red");
}
