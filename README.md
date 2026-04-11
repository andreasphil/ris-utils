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

Then clone the repository and install dependencies:

```sh
git clone git@github.com:andreasphil/ris-utils.git
cd ris-utils
pnpm install
```

## Scripts

### Bump all GUIDs

```sh
node bump-guids.js <xml-file>
```

Reads the specified file and replaces all instances of `GUID="..."` with a new GUID. Will also replace the value if the GUID is empty or invalid. This can be used as a convenient way of making sure all GUIDs in an XML file are unique and valid.

### Character count ignoring whitespace

```sh
node char-count-ignoring-whitespace.js <search-string> <text>
```

Finds all instances of `search-string` in `text` and prints the corresponding character range as it would be specified in the destination of an amending command in LDML.de. Whitespace in both the search string and the text is trimmed and consecutive spaces are replaced by a single space.

### Get ticket ref for commit message

```sh
node get-commit-message-reference.js <path-to-commit-message-file> <message-type>
```

**Intended to be used as the `prepare-commit-msg` hook.** Pre-fills the commit message with a ticket reference in case one is included in the current branch name (e.g. `risdev-1234-some-feature`). Otherwise `RISDEV-0000` is used as the default.

Example usage with lefthook:

```yaml
# lefthook-local.yaml
prepare-commit-msg:
  commands:
    insert-reference:
      run: node ../ris-utils/get-commit-message-reference.js {0}
```

### GitHub run list output to CSV

```sh
gh run list <options> > out.txt
node gh-run-list-to-csv.js out.txt
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

### HTML inline style report

Analyzes inline styles across HTML documents from the ris-search staging API and generates a report. Requires the [1Password CLI](https://developer.1password.com/docs/cli/) (`op`) to be signed in for fetching credentials.

**Step 1:** Download HTML samples (default: 100 documents per type, max 300):

```sh
node ris-search/html-samples/download.mjs [--size <n>]
```

**Step 2:** Analyze the downloaded samples and generate the report:

```sh
node ris-search/html-samples/analyze.mjs
```

The report is written to `ris-search/html-samples/report.html`.

## Mise tasks

The repository includes a `mise.toml` for each project, containing shortcuts and small scripts for tasks I often perform. To get started, create a symlink to the file inside the project:

```sh
# ris-norms
ln -s path-to/ris-utils/ris-norms/mise.toml path-to/ris-norms/mise.toml
```

Then run `mise tasks` to see a list of all available tasks.
