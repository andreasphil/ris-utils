<h1 align="center">
  RIS Utils 🦉
</h1>

<p align="center">
  <strong>Scripts and utilities related to <a href="https://github.com/topics/neuris">NeuRIS</a></strong>
</p>

## Installation

Clone the repository to get started.

You'll need [Node](https://nodejs.org/), [just](https://just.systems), and [Atlassian CLI](https://developer.atlassian.com/cloud/acli/)

```sh
brew tap atlassian/homebrew-acli
brew install node just acli
```

Then clone the repository and install dependencies:

```sh
git clone git@github.com:andreasphil/ris-utils.git
cd ris-utils
npm i
```

## Scripts

### Bump all GUIDs

```sh
node bump-guids.ts <xml-file>
```

Reads the specified file and replaces all instances of `GUID="..."` with a new GUID. Will also replace the value if the GUID is empty or invalid. This can be used as a convenient way of making sure all GUIDs in an XML file are unique and valid.

### Character count ignoring whitespace

```sh
node char-count-ignoring-whitespace.ts <search-string> <text>
```

Finds all instances of `search-string` in `text` and prints the corresponding character range as it would be specified in the destination of an amending command in LDML.de. Whitespace in both the search string and the text is trimmed and consecutive spaces are replaced by a single space.

### Get ticket ref for commit message

```sh
node get-commit-message-reference.ts <path-to-commit-message-file> <message-type>
```

**Intended to be used as the `prepare-commit-msg` hook.** Pre-fills the commit message with a ticket reference in case one is included in the current branch name (e.g. `risdev-1234-some-feature`). Otherwise `RISDEV-0000` is used as the default.

Example usage with lefthook:

```yaml
# lefthook-local.yaml
prepare-commit-msg:
  commands:
    insert-reference:
      run: node ../ris-utils/get-commit-message-reference.ts {0}
```

### GitHub run list output to CSV

```sh
gh run list <options> > out.txt
node gh-run-list-to-csv.ts out.txt
```

Takes the output of a GitHub CLI run listing and converts it to a CSV for processing in a spreadsheet app.

### Switch branch from Jira

```sh
node switch-branch-from-jira.js [--watched]
```

Loads the work items currently assigned to your user from Jira and lists them. Select an item from the list to switch to the branch for that item. If the branch doesn't exist, you'll be prompted whether it should be created.

If you provide the `--watched` flag, the list will include items you're watching in addition to your assigned items.

Note that this requires to you be signed in to Jira through the Atlassian CLI.

For convenience, you can add an alias to your global `.gitconfig` like this:

```
[alias]
  switch-jira = !node path-to/ris-utils/switch-branch-from-jira.js
```

### Which ELI

```sh
node which-eli.js <list of ELIs>
```

For all provided ELIs, checks what their type(s) are and prints the values of the individual components.

## Justfile

The repository includes a `justfile`, containing many shortcuts and small scripts for tasks I often perform in the project. To get started, create a link to the file inside the repository:

```sh
# or: ris-search + search.justfile
cd ris-norms
ln -s path-to/ris-utils/norms.justfile ./justfile
```

Then run `just --list` to see a list of all available tasks.
