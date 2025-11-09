import { readFileSync, writeFileSync } from "node:fs";
import { argv } from "node:process";

const [file] = argv.slice(2);

function duration(val: string) {
  if (!val) {
    console.warn("[warn] cannot convert falsy value to duration");
    return "";
  }

  const match = val.match(/((?<h>\d\d?)h)?((?<m>\d\d?)m)?(?<s>\d\d?)s/);

  if (!match?.groups) {
    console.warn(`[warn] cannot convert "${val}" to duration`);
    return "";
  }

  return [match.groups.h, match.groups.m, match.groups.s]
    .map((i) => i || "0")
    .map((i) => i.padStart(2, "0"))
    .join(":");
}

function date(val: string) {
  if (!val) console.warn(`[warn] cannot convert falsy value to date`);
  return val?.substring(0, 10) ?? "";
}

const entries = readFileSync(file, "utf-8")
  .split("\n")
  .map((i) => i.split("\t"))
  .map((i) => ({
    status: i[0],
    result: i[1],
    message: i[2],
    name: i[3],
    branch: i[4],
    trigger: i[5],
    id: i[6],
    elapsed: duration(i[7]),
    timestamp: date(i[8]),
  }))
  .map((i) => [
    i.branch,
    i.name,
    i.trigger,
    i.elapsed,
    i.timestamp,
    `"${i.message}"`,
    i.status,
    i.result,
  ])
  .map((i) => i.join(","))
  .join("\n");

const csv =
  "branch,name,trigger,elapsed,timestamp,message,status,result\n" + entries;

writeFileSync(file.replace(".txt", ".csv"), csv, "utf-8");
