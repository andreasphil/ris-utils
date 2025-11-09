// @ts-check
import { exec as execCb } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";
import { promisify, styleText } from "node:util";
import prompts from "prompts";
import spinner from "yocto-spinner";

/**
 * @typedef {object} WorkItem
 * @property {string} key
 * @property {object} fields
 * @property {string} fields.summary
 * @property {object} fields.assignee
 * @property {string} fields.assignee.displayName
 * @property {object} fields.issuetype
 * @property {string} fields.issuetype.name
 * @property {object} fields.priority
 * @property {string} fields.priority.name
 * @property {object} fields.status
 * @property {string} fields.status.name
 */

const exec = promisify(execCb);

/**
 * @param {object} options
 * @param {boolean} [options.includeWatched=false]
 * @returns {Promise<WorkItem[]>}
 */
async function getWorkItems({ includeWatched = false }) {
  let raw;

  if (existsSync("./workItems.json")) {
    // dev mode: read tasks from file if it exists
    raw = await readFile("./workItems.json", "utf-8");
  } else {
    const query = `${
      includeWatched
        ? "(assignee = currentUser() OR watcher = currentUser())"
        : "assignee = currentUser()"
    } AND statusCategory != Done`;

    const { stdout } = await exec(
      ["acli", "jira workitem search", "--json", `--jql="${query}"`].join(" "),
    );
    raw = stdout;
  }

  return JSON.parse(raw);
}

/**
 * @param {WorkItem} item
 * @returns {string}
 */
function formatWorkItem(item) {
  // Priority
  let prio = styleText("yellow", "-");
  switch (item.fields.priority.name) {
    case "Highest":
      prio = styleText("red", ">>");
      break;
    case "High":
      prio = styleText("red", ">");
      break;
    case "Low":
      prio = styleText("blue", "<");
      break;
    case "Highest":
      prio = styleText("blue", "<<");
      break;
  }

  return `${prio} ${item.key} [${item.fields.status.name.toLowerCase()}]: ${item.fields.summary}`;
}

/**
 * @param {WorkItem[]} options
 * @returns {Promise<WorkItem>}
 */
async function chooseFromWorkItems(options) {
  const selection = await prompts({
    type: "autocomplete",
    name: "value",
    message: "pick a work item",

    suggest: async (input, choices) => {
      if (!input) return choices;
      input = input.toLowerCase();
      return choices.filter((choice) =>
        choice.title.toLowerCase().includes(input),
      );
    },

    choices: options.map((i) => ({
      title: formatWorkItem(i),
      value: i,
    })),
  });

  return selection.value;
}

/**
 * @param {WorkItem} workItem
 * @returns {string}
 */
function formatBranchName(workItem) {
  const key = workItem.key.toLowerCase();
  const title = workItem.fields.summary.replace(/\W+/g, "-").toLowerCase();
  return `${key}-${title}`;
}

/** @param {string} name */
async function branchExists(name) {
  try {
    await exec(`git branch | grep ${name}`);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} name */
async function createOrSwitchBranch(name) {
  if (await branchExists(name)) {
    await exec(`git switch ${name}`);
  } else {
    const { value: shouldCreate } = await prompts({
      type: "confirm",
      name: "value",
      message: `create branch ${name}?`,
      initial: true,
    });

    if (shouldCreate) await exec(`git switch -c ${name}`);
    else exit(1);
  }
}

const args = argv.slice(2);

const status = spinner({ text: "loading work items" }).start();

let workItems;

try {
  workItems = await getWorkItems({
    includeWatched: args.includes("--watched"),
  });
  status.stop();
} catch (e) {
  status.error("failed to load work items");
  exit(1);
}

const workItem = await chooseFromWorkItems(workItems);
if (!workItem) exit(1);

await createOrSwitchBranch(formatBranchName(workItem));
