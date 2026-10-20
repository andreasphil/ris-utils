#!/usr/bin/env node
// Copies project-specific files between this repo and project clones.
//
//   install <project> [--dir <path>]   copy ris-utils/<project>/* into the clone
//   sync <project> [--dir <path>]      copy the files back from the clone
//   add <project> <path>... [--dir <path>]
//                                      start tracking files from the clone
//
// ris-utils/<project>/ is the source of truth for which files are tracked.

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"

const UTILS_ROOT = path.resolve(import.meta.dirname, "..")
const IGNORED_NAMES = new Set([".DS_Store"])
const EXCLUDE_START = "# >>> ris-utils (managed, do not edit)"
const EXCLUDE_END = "# <<< ris-utils"

const usage = "usage: project-files.mjs <install|sync|add> <project> [<path>...] [--dir <path>]"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { dir: { type: "string" } },
})
const [command, project, ...paths] = positionals
if (!["install", "sync", "add"].includes(command) || !project) fail(usage)
if ((command === "add") !== paths.length > 0) fail(usage)

const utilsDir = path.join(UTILS_ROOT, project)
if (!fs.existsSync(utilsDir)) fail(`No such project in ris-utils: ${utilsDir}`)

const projectDir = path.resolve(values.dir ?? path.join(UTILS_ROOT, "..", project))
if (!fs.existsSync(projectDir)) fail(`Project directory not found: ${projectDir}`)

if (command === "install") install()
else if (command === "sync") sync()
else add()

function install() {
  const files = listFiles(utilsDir)

  const existing = files.filter((f) => fs.existsSync(path.join(projectDir, f)))
  if (existing.length > 0) {
    fail(
      `These files already exist in ${projectDir}, nothing was changed:\n` +
        existing.map((f) => `  ${f}`).join("\n"),
    )
  }

  for (const file of files) copy(path.join(utilsDir, file), path.join(projectDir, file))
  writeExcludeBlock(files)
  console.log(`Installed ${files.length} files into ${projectDir}`)
}

function sync() {
  if (readExcludeBlock() === undefined) {
    fail(`${projectDir} has no ris-utils block in .git/info/exclude. Run install first.`)
  }

  // Untracked files are ignored so that files from `add` don't block the sync.
  const dirty = git(UTILS_ROOT, "status", "--short", "--untracked-files=no", "--", project)
  if (dirty) fail(`Uncommitted changes in ris-utils/${project}, commit or stash first:\n${dirty}`)

  const files = listFiles(utilsDir)
  const missing = files.filter((f) => !fs.existsSync(path.join(projectDir, f)))
  if (missing.length === files.length) {
    fail(`None of the tracked files exist in ${projectDir}, refusing to delete everything.`)
  }

  for (const file of files) {
    if (missing.includes(file)) {
      fs.rmSync(path.join(utilsDir, file))
      removeEmptyParents(path.dirname(path.join(utilsDir, file)))
      console.log(`deleted  ${file}`)
    } else {
      copy(path.join(projectDir, file), path.join(utilsDir, file))
    }
  }
  writeExcludeBlock(files.filter((f) => !missing.includes(f)))

  const status = git(UTILS_ROOT, "status", "--short", "--", project)
  console.log(status ? `\nChanges in ris-utils:\n${status}` : "\nNo changes.")
  if (status) console.log(`\nReview with: git -C ${UTILS_ROOT} diff -- ${project}`)
}

// Paths are relative to the project clone. Directories are added recursively.
function add() {
  if (readExcludeBlock() === undefined) {
    fail(`${projectDir} has no ris-utils block in .git/info/exclude. Run install first.`)
  }

  const files = []
  for (const p of paths) {
    const full = path.resolve(projectDir, p)
    if (!fs.existsSync(full)) fail(`Not found: ${full}`)
    const relative = path.relative(projectDir, full)
    if (relative.startsWith("..")) fail(`Not inside ${projectDir}: ${full}`)
    if (fs.statSync(full).isDirectory()) {
      files.push(...listFiles(full).map((f) => path.join(relative, f)))
    } else {
      files.push(relative)
    }
  }

  const tracked = files.filter((f) => git(projectDir, "ls-files", "--", f))
  if (tracked.length > 0) {
    fail(`These files are tracked in the project, nothing was changed:\n${tracked.map((f) => `  ${f}`).join("\n")}`)
  }
  const known = files.filter((f) => fs.existsSync(path.join(utilsDir, f)))
  if (known.length > 0) {
    fail(`These files are already in ris-utils, nothing was changed:\n${known.map((f) => `  ${f}`).join("\n")}`)
  }

  for (const file of files) {
    copy(path.join(projectDir, file), path.join(utilsDir, file))
    console.log(`added    ${file}`)
  }
  writeExcludeBlock(listFiles(utilsDir))
}

function listFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !IGNORED_NAMES.has(e.name))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
    .sort()
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  fs.chmodSync(to, fs.statSync(from).mode)
}

function removeEmptyParents(dir) {
  while (dir !== utilsDir && fs.readdirSync(dir).every((n) => IGNORED_NAMES.has(n))) {
    fs.rmSync(dir, { recursive: true })
    dir = path.dirname(dir)
  }
}

// The exclude file lives in the common git dir, so worktrees share it.
function excludePath() {
  const commonDir = git(projectDir, "rev-parse", "--path-format=absolute", "--git-common-dir")
  return path.join(commonDir, "info", "exclude")
}

function readExcludeBlock() {
  const file = excludePath()
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  const start = content.indexOf(EXCLUDE_START)
  const end = content.indexOf(EXCLUDE_END)
  if (start === -1 || end === -1) return undefined
  return { content, start, end: end + EXCLUDE_END.length }
}

function writeExcludeBlock(files) {
  const file = excludePath()
  const block = [EXCLUDE_START, ...files.map((f) => `/${f}`), EXCLUDE_END].join("\n")
  const current = readExcludeBlock()
  let content
  if (current) {
    content = current.content.slice(0, current.start) + block + current.content.slice(current.end)
  } else {
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
    content = `${before}${before && !before.endsWith("\n") ? "\n" : ""}${block}\n`
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).replace(/\n$/, "")
}

function fail(message) {
  console.error(message)
  process.exit(1)
}
