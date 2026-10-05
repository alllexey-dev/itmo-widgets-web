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
const roles = [
  "surface",
  "surfaceContainerLow",
  "surfaceContainer",
  "surfaceContainerHigh",
  "onSurface",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "primary",
  "onPrimary",
  "primaryContainer",
  "onPrimaryContainer",
  "secondaryContainer",
  "onSecondaryContainer",
  "error",
  "onError",
  "scrim",
  "inverseSurface",
  "inverseOnSurface",
  "inversePrimary",
  "errorContainer",
  "onErrorContainer",
];
const aliases = {
  surfaceContainerLow: "surface-low",
  surfaceContainerHigh: "surface-high",
};
const status = [
  "successContainer",
  "onSuccessContainer",
  "warningContainer",
  "onWarningContainer",
  "infoContainer",
  "onInfoContainer",
];
const siteRoles = [
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
const pairs = (target) => {
  const result = [];
  for (const role of target === "web" ? roles : siteRoles) {
    result.push([
      aliases[role] ?? kebab(role),
      ...["light", "dark"].map((theme) =>
        value(`color.scheme.${theme}.${role}`),
      ),
    ]);
  }
  for (const role of target === "web" ? status : ["phone", "phoneRing"]) {
    result.push([
      kebab(role),
      ...["light", "dark"].map((theme) =>
        value(`color.extended.${theme}.${role}`),
      ),
    ]);
  }
  if (target === "web") {
    result.push([
      "shadow-overlay",
      value("color.derived.shadowOverlay.light"),
      value("color.derived.shadowOverlay.dark"),
    ]);
  }
  return result;
};
const staticProperties = (target) => {
  const corner = (name) => value(`shape.corner.${name}`, "px");
  if (target === "site")
    return [
      ["radius", corner("largeIncreased")],
      ["max", value("layout.landingMax", "px")],
    ];
  const result = [
    ["qr-light", value("color.extended.light.qrLight")],
    ["qr-dark", value("color.extended.light.qrDark")],
    ["font-sans", value("type.fontFamily")],
    ["font-mono", value("type.monoFontFamily")],
  ];
  for (const [step, name] of Object.entries({
    1: "related",
    2: "compact",
    3: "content",
    4: "group",
    5: "summaryPadding",
    6: "section",
    8: "statePadding",
    10: "large",
  }))
    result.push([`space-${step}`, value(`spacing.${name}`, "px")]);
  for (const [name, role] of Object.entries({
    radius: "largeIncreased",
    "radius-m": "large",
    "radius-s": "medium",
    "radius-xs": "small",
    "radius-pill": "full",
  }))
    result.push([name, corner(role)]);
  for (const [name, role] of Object.entries({
    display: "displaySmall",
    "title-l": "titleLarge",
    "title-m": "titleMedium",
    "title-s": "titleSmall",
    "body-m": "bodyMedium",
    "body-s": "bodySmall",
    label: "labelLarge",
  }))
    result.push([`text-${name}`, value(`type.roles.${role}.size`, "px")]);
  const easing = tokens.motion.easing;
  if (
    !Array.isArray(easing) ||
    easing.length !== 4 ||
    easing.some((part) => typeof part !== "number" || !Number.isFinite(part))
  ) {
    throw new Error("Expected four finite motion.easing coordinates");
  }
  result.push(
    ["touch", value("layout.touchTarget", "px")],
    ["focus-ring", value("color.derived.focusRing")],
    ["duration", value("motion.durationMs.standard", "ms")],
    ["ease", `cubic-bezier(${easing.join(", ")})`],
    ["nav-width", value("layout.navWidth", "px")],
    ["topbar-height", value("layout.topbarHeight", "px")],
    ["content-max", value("layout.contentMax", "px")],
  );
  return result;
};
const declarations = (entries, indent = "  ") =>
  entries.map(([name, text]) => `${indent}--${name}: ${text};`).join("\n");
const modern = (name, light, dark) => {
  // light-dark() accepts colours, not a shadow list; vary only the shadow colour.
  if (name === "shadow-overlay") {
    const lightParts = light.match(/^(.*?)(rgba?\(.+\))$/);
    const darkParts = dark.match(/^(.*?)(rgba?\(.+\))$/);
    if (!lightParts || !darkParts || lightParts[1] !== darkParts[1]) {
      throw new Error("Shadow overlay must differ only in its colour");
    }
    return `${lightParts[1]}light-dark(${lightParts[2]}, ${darkParts[2]})`;
  }
  return `light-dark(${light}, ${dark})`;
};
const render = (target) => {
  const themed = pairs(target);
  const dark = themed.map(([name, , text]) => [name, text]);
  return `/* Generated from tokens/tokens.json by scripts/gen-tokens.mjs; do not edit. */
:root {
  color-scheme: light;
${declarations(themed.map(([name, light]) => [name, light]))}
${declarations(staticProperties(target))}
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
  themed.map(([name, light, dark]) => [name, modern(name, light, dark)]),
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
  [resolve(root, "web/src/ui/tokens.css"), render("web")],
  [
    sitePath,
    site.slice(0, site.indexOf(start)) +
      start +
      "\n" +
      render("site") +
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
  check ? "Generated tokens are current." : "Generated web and site tokens.",
);
