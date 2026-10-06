#!/usr/bin/env node
// Generated CSS has one source: tokens/tokens.json. No dependencies or network.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--check") || args.length > 1) {
  console.error("Usage: node scripts/gen-tokens.mjs [--check]");
  process.exit(2);
}
const check = args.includes("--check");
const tokens = JSON.parse(
  readFileSync(resolve(root, "tokens/tokens.json"), "utf8"),
);
if (tokens.schemaVersion !== 1 || !["web", "app"].includes(tokens.source)) {
  throw new Error("Expected schemaVersion 1 and source web or app");
}
const value = (path, unit = "") => {
  const found = path.split(".").reduce((part, key) => part?.[key], tokens);
  if (
    !["string", "number"].includes(typeof found) ||
    (typeof found === "number" && !Number.isFinite(found)) ||
    /[;{}\n\r]/.test(String(found))
  ) {
    throw new Error(`Missing or invalid token: ${path}`);
  }
  return `${found}${unit}`;
};
const kebab = (role) =>
  role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
// The web app takes its theme from @alllexey/ui (WB-16a); only the landing block is generated here.
const roles = [
  "surface",
  "surfaceContainerLow",
  "surfaceContainerHigh",
  "onSurface",
  "onSurfaceVariant",
  "outlineVariant",
  "primary",
  "onPrimary",
  "secondaryContainer",
  "onSecondaryContainer",
];
const aliases = {
  surfaceContainerLow: "surface-low",
  surfaceContainerHigh: "surface-high",
};
const pairs = () => {
  const result = [];
  for (const role of roles) {
    result.push([
      aliases[role] ?? kebab(role),
      ...["light", "dark"].map((theme) =>
        value(`color.scheme.${theme}.${role}`),
      ),
    ]);
  }
  for (const role of ["phone", "phoneRing"]) {
    result.push([
      kebab(role),
      ...["light", "dark"].map((theme) =>
        value(`color.extended.${theme}.${role}`),
      ),
    ]);
  }
  return result;
};
const staticProperties = () => [
  ["radius", value("shape.corner.largeIncreased", "px")],
  ["max", value("layout.landingMax", "px")],
];
const declarations = (entries, indent = "  ") =>
  entries.map(([name, text]) => `${indent}--${name}: ${text};`).join("\n");
const render = () => {
  const themed = pairs();
  const dark = themed.map(([name, , text]) => [name, text]);
  return `/* Generated from tokens/tokens.json by scripts/gen-tokens.mjs; do not edit. */
:root {
  color-scheme: light;
${declarations(themed.map(([name, light]) => [name, light]))}
${declarations(staticProperties())}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
  }
}
:root[data-theme='dark'] {
  color-scheme: dark;
}

/* One modern definition follows color-scheme for system and manual themes. */
@supports (color: light-dark(white, black)) {
  :root {
${declarations(
  themed.map(([name, light, dark]) => [name, `light-dark(${light}, ${dark})`]),
  "    ",
)}
  }
}

/* Safari < 17.5 and other legacy engines need literal selector/media fallbacks. */
@supports not (color: light-dark(white, black)) {
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
${declarations(dark, "      ")}
    }
  }
  :root[data-theme='dark'] {
${declarations(dark, "    ")}
  }
}
`;
};
const sitePath = resolve(root, "site/style.css");
const site = readFileSync(sitePath, "utf8");
const start = "/* BEGIN GENERATED TOKENS */";
const end = "/* END GENERATED TOKENS */";
if (
  site.split(start).length !== 2 ||
  site.split(end).length !== 2 ||
  site.indexOf(start) > site.indexOf(end)
) {
  throw new Error(
    "site/style.css needs exactly one ordered generated token block",
  );
}
const outputs = [
  [
    sitePath,
    site.slice(0, site.indexOf(start)) +
      start +
      "\n" +
      render() +
      end +
      site.slice(site.indexOf(end) + end.length),
  ],
];
let drift = false;
for (const [path, generated] of outputs) {
  if (check) {
    if (readFileSync(path, "utf8") !== generated) {
      console.error(`Token drift: ${path.slice(root.length + 1)}`);
      drift = true;
    }
  } else writeFileSync(path, generated);
}
if (drift) process.exit(1);
console.log(
  check ? "Generated tokens are current." : "Generated landing tokens.",
);
