#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--app")) {
  throw new Error("Usage: scripts/sync-app-labels.mjs [--app <dir>]");
}
const app = resolve(args[1] ?? `${homedir()}/proj/.wt/android/next`);
const git = (...args) =>
  execFileSync("git", ["-C", app, ...args], { encoding: "utf8" });
const sha = git("rev-parse", "HEAD").trim();
if (git("status", "--porcelain").trim())
  throw new Error("App source must be clean");
git("merge-base", "--is-ancestor", sha, "origin/v2.3/next");
const strings = {};
const paths = git("ls-tree", "-r", "--name-only", sha)
  .trim()
  .split("\n")
  .sort();
for (const path of paths) {
  if (
    path.split("/").includes("build") ||
    !/(^|\/)values\/strings[^/]*\.xml$/.test(path)
  )
    continue;
  const entries = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        `
import json, sys, xml.etree.ElementTree as ET
root = ET.fromstring(sys.stdin.read())
print(json.dumps([(node.attrib['name'], ''.join(node.itertext())) for node in root.findall('string')], ensure_ascii=False))
`,
      ],
      { input: git("show", `${sha}:${path}`), encoding: "utf8" },
    ),
  );
  for (const [name, value] of entries) {
    // Android escapes punctuation inside XML strings; the fixture stores rendered text.
    const text = value
      .replace(/\\([\\"'])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
    if (Object.hasOwn(strings, name) && strings[name] !== text) {
      throw new Error(`Conflicting string ${name} in ${path}`);
    }
    strings[name] = text;
  }
}
if (!Object.keys(strings).length) throw new Error("No app strings found");
const icons = {};
const [header, ...rows] = git("show", `${sha}:docs/design/icons.tsv`)
  .trim()
  .split("\n");
const columns = header.split("\t");
const idColumn = columns.indexOf("id");
const symbolColumn = columns.indexOf("symbol");
if (idColumn < 0 || symbolColumn < 0)
  throw new Error("Icon registry needs id and symbol columns");
for (const row of rows) {
  const cells = row.split("\t");
  const id = cells[idColumn];
  const symbol = cells[symbolColumn];
  if (!id || !symbol || Object.hasOwn(icons, id))
    throw new Error(`Invalid icon registry row: ${row}`);
  icons[id] = symbol;
}
if (!Object.keys(icons).length) throw new Error("No app icons found");
const sorted = (values) =>
  Object.fromEntries(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key]]),
  );
const fixture = { appSha: sha, strings: sorted(strings), icons: sorted(icons) };
// The React app and the Svelte app keep identical copies until WV-06 removes the React one.
for (const target of ["web", "web-next"]) {
  const output = resolve(
    dirname(fileURLToPath(import.meta.url)),
    `../${target}/src/test/fixtures/app-labels.json`,
  );
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Updated ${output} from app ${sha}`);
}
