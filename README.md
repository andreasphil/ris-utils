<h1 align="center">
  RIS Utils 🦉
</h1>

<p align="center">
  <strong>Scripts and utilities related to <a href="https://github.com/digitalservicebund/ris-norms/">ris-norms</a></strong>
</p>

## Installation

You'll need [Deno](https://deno.com/):

```sh
brew install deno
```

You can then run the scripts by either cloning the repository and running them locally, or running them from the corresponding raw file URL from GitHub directly.

## Usage

### Bump all GUIDs

```sh
deno run --allow-read --allow-write bump-guids.ts <xml-file>
```

Reads the specified file and replaces all instances of `GUID="..."` with a new GUID. Will also replace the value if the GUID is empty or invalid. This can be used as a convenient way of making sure all GUIDs in an XML file are unique and valid.

### Character count ignoring whitespace

```sh
deno run --allow-env char-count-ignoring-whitespace.ts <search-string> <text>
```

Finds all instances of `search-string` in `text` and prints the corresponding character range as it would be specified in the destination of an amending command in LDML.de. Whitespace in both the search string and the text is trimmed and consecutive spaces are replaced by a single space.

### GitHub run list output to CSV

```sh
gh run list <options> > out.txt
deno run --allow-read --allow-write gh-run-list-to-csv.ts out.txt
```

Takes the output of a GitHub CLI run listing and converts it to a CSV for processing in a spreadsheet app.
