import { argv, exit } from "node:process";
import { styleText } from "node:util";

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * @param {string} substr
 * @param {string} value
 * @returns {[number, number][]}
 */
function findAll(substr, value) {
  /** @type {[number, number][]} */
  const result = [];
  let position = 0;

  while (position < value.length) {
    const index = value.indexOf(substr, position);
    if (index >= 0) {
      result.push([index, index + substr.length]);
      position = index + substr.length;
    } else break;
  }

  return result;
}

/**
 * @param {[number, number][]} ranges
 * @returns {string}
 */
function printRanges(ranges) {
  return ranges.map(([from, to]) => `${from}-${to}`).join(", ");
}

/**
 * @param {string} value
 * @param {[number, number][]} ranges
 * @returns {string}
 */
function printResult(value, ranges) {
  let result = "";
  let cursor = 0;

  // Assumes that ranges are sorted and don't overlap
  for (const [from, to] of ranges) {
    result += value.substring(cursor, from);
    result += styleText(["black", "bgYellow"], value.substring(from, to));
    cursor = to;
  }

  result += value.substring(cursor);

  return result;
}

let [searchStr, input] = argv.slice(2);
if (!searchStr || !input) {
  console.error(styleText("red", "Search string and text can't be empty!"));
  console.log("Usage: char-count-ignoring-whitespace.js <search> <text>");
  exit(1);
}

input = normalizeWhitespace(input);
searchStr = normalizeWhitespace(searchStr);
const ranges = findAll(searchStr, input);

console.log(styleText(["cyan", "bold"], `Searching for: "${searchStr}"`));

console.log(styleText(["cyan", "bold"], "In:") + ` "${input}"`);

if (ranges.length) {
  console.log(
    styleText(["cyan", "bold"], "Found ranges:") + ` ${printRanges(ranges)}`,
  );

  console.log("");
  console.log(printResult(input, ranges));
} else console.log(styleText(["red"], "No matches found"));
