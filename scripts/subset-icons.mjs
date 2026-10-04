#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const revision = "737e3324305806514d7909874fa1818ae1808232";
const source = `https://raw.githubusercontent.com/google/material-design-icons/${revision}/`;
const files = [
  [
    "font.ttf",
    "variablefont/MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.ttf",
    "95b24392bb49efd1bc3e92cff4e2452ad094461bab7c97e7d8723fab97e330ca",
  ],
  [
    "codepoints",
    "variablefont/MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.codepoints",
    "225bd09137103cb7746bc93dc08d08764c9f0c3bd04f4b958d4a3c3c19432dd6",
  ],
  [
    "LICENSE",
    "LICENSE",
    "58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd",
  ],
];
const names = [
  ...(await readFile(resolve(root, "web/src/ui/icons.ts"), "utf8")).matchAll(
    /'([a-z0-9_]+)'/g,
  ),
].map((match) => match[1]);
if (!names.length || names.join() !== [...new Set(names)].sort().join())
  throw new Error("Icon names must be unique and sorted");
const output = resolve(root, "web/public/fonts");
const temporary = await mkdtemp(join(tmpdir(), "material-symbols-"));
try {
  await mkdir(output, { recursive: true });
  for (const [name, path, hash] of files) {
    const response = await fetch(source + path);
    if (!response.ok)
      throw new Error(`Upstream ${path}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw new Error(`Upstream checksum mismatch: ${path}`);
    await writeFile(join(temporary, name), bytes);
  }
  await writeFile(join(temporary, "names"), names.join("\n") + "\n");
  // Install fonttools[woff]==4.60.1 and brotli==1.1.0 in an isolated Python environment.
  execFileSync(
    process.env.PYTHON || "python3",
    [
      "-c",
      String.raw`
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import fontTools
assert fontTools.__version__ == '4.60.1', 'Use fonttools[woff]==4.60.1'
source, output = map(Path, sys.argv[1:])
names = source.joinpath('names').read_text().splitlines()
codepoints = dict(line.split() for line in source.joinpath('codepoints').read_text().splitlines())
font = TTFont(source / 'font.ttf', recalcTimestamp=False)
cmap = font.getBestCmap()
targets = {cmap[int(codepoints[name], 16)] for name in names}
reverse = {glyph: chr(code) for code, glyph in cmap.items() if code < 128}
# Remove unrelated ligature rules before closure, even if they use the same letters.
for lookup in font['GSUB'].table.LookupList.Lookup:
    for table in lookup.SubTable:
        table = getattr(table, "ExtSubTable", table)
        if hasattr(table, 'ligatures'):
            table.ligatures = {key: [rule for rule in rules if rule.LigGlyph in targets
                                     and ''.join(reverse[glyph] for glyph in [key, *rule.Component]) in names]
                              for key, rules in table.ligatures.items()}
options = subset.Options()
options.flavor = 'woff2'
options.recalc_timestamp = False
subsetter = subset.Subsetter(options)
subsetter.populate(glyphs=targets, text=''.join(names))
subsetter.subset(font)
font = instantiateVariableFont(font, {'opsz': 24, 'wght': 400, 'GRAD': 0}, inplace=True)
font.flavor = 'woff2'
font.save(output / 'material-symbols-rounded.woff2')
# Verify actual GSUB sequences against every requested ligature, not only cmap entries.
font = TTFont(output / 'material-symbols-rounded.woff2')
reverse = {glyph: chr(code) for code, glyph in font.getBestCmap().items() if code < 128}
ligatures = set()
for lookup in font['GSUB'].table.LookupList.Lookup:
    for table in lookup.SubTable:
        table = getattr(table, "ExtSubTable", table)
        for first, rules in getattr(table, 'ligatures', {}).items():
            for rule in rules:
                ligatures.add(''.join(reverse[glyph] for glyph in [first, *rule.Component]))
assert ligatures == set(names), (set(names) - ligatures, ligatures - set(names))
axes = font['fvar'].axes
assert len(axes) == 1 and axes[0].axisTag == 'FILL'
assert (axes[0].minValue, axes[0].defaultValue, axes[0].maxValue) == (0, 0, 1)
print(f'Verified {len(names)} exact ligatures and FILL 0..1')
`,
      temporary,
      output,
    ],
    { stdio: "inherit" },
  );
  await writeFile(
    join(output, "LICENSE"),
    await readFile(join(temporary, "LICENSE")),
  );
  await writeFile(join(output, "names.txt"), names.join("\n") + "\n");
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify(
      {
        revision,
        names,
        axes: { FILL: [0, 0, 1], opsz: 24, wght: 400, GRAD: 0 },
        sha256: createHash("sha256")
          .update(
            await readFile(join(output, "material-symbols-rounded.woff2")),
          )
          .digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Pinned source: google/material-design-icons@${revision}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
