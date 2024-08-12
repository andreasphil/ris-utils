import { exec as execCb } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execCb);

/**
 * @returns {Promise<string>}
 */
async function getBranchName() {
  const { stdout } = await exec("git branch --show-current");
  return stdout;
}

/**
 * @param {string} source
 * @returns {string}
 */
function getReference(source) {
  const match = source.match(/risdev-\d+/i);
  if (!match) return "RISDEV-0000";
  return match[0].toUpperCase();
}

/**
 * @param {string} outpath
 * @returns {Promise<void>}
 */
async function prepareMessage(outpath) {
  const outpathAbs = resolve(outpath);

  const branchName = await getBranchName();
  const reference = getReference(branchName);
  let message = readFileSync(outpathAbs, { encoding: "utf-8" });

  message = `\n\n${reference}\n${message}`;
  writeFileSync(outpathAbs, message, { encoding: "utf-8" });
}

const [outpath, type] = process.argv.slice(2);
if (!type) await prepareMessage(outpath);
