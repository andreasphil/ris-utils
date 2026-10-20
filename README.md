<h1 align="center">
  RIS Utils 🦉
</h1>

<p align="center">
  <strong>Scripts and utilities related to <a href="https://github.com/topics/neuris">NeuRIS</a></strong>
</p>

## Installation

You'll need [Node](https://nodejs.org/), [mise](https://mise.jdx.dev), and [Atlassian CLI](https://developer.atlassian.com/cloud/acli/):

```sh
brew tap atlassian/homebrew-acli
brew install node mise acli
```

Then clone the repository and install the dependencies:

```sh
git clone git@github.com:andreasphil/ris-utils.git
cd ris-utils/scripts
pnpm install
```

## Scripts

### Switch branch from Jira

```sh
node scripts/switch-branch-from-jira.js [--watched]
```

Lists the Jira work items assigned to you. Pick one to switch to its branch. If the branch doesn't exist yet, the script asks whether to create it. With `--watched`, the list also includes items you're watching.

You need to be signed in to Jira through the Atlassian CLI.

I run it through an alias in my global `.gitconfig`:

```
[alias]
  switch-jira = !node path-to/ris-utils/scripts/switch-branch-from-jira.js
```

## Project files

Each project folder, like `ris-search/`, holds files I add to my clone of that project, such as `CLAUDE.md`, Claude skills, and editor settings. The tasks copy these files into the clone.

The project folder decides which files belong to a project. The tasks expect the clone next to this repository, for example `../ris-search`. Pass `--dir <path>` to use a different one.

### Install

```sh
mise run install ris-search [--dir <path>]
```

Copies every file from `ris-search/` into the clone and adds it to the clone's `.git/info/exclude`, so git ignores it. If any of the files already exist in the clone, the task lists them and stops without changing anything.

To install into a worktree, pass its path: `mise run install ris-search --dir ../ris-search-worktree`.

### Sync

```sh
mise run sync ris-search [--dir <path>]
```

Copies the files from the clone back into this repository. I make my changes in the clone and sync now and then as a backup.

If you delete a file in the clone, sync deletes it here too.

If `ris-search/` has uncommitted changes to tracked files, sync refuses to run. Otherwise its output would mix your changes with the ones from the sync.

When it's done, it prints what changed. Review the changes with `git diff`, then commit.

### Add

```sh
mise run add ris-search <path>... [--dir <path>]
```

Starts tracking new files from the clone. Paths are relative to the clone, and a directory adds every file inside it. The files land here untracked until you commit them. The next sync lists them with `??`.

If a file already exists here or git tracks it in the project, `add` stops without changing anything.
