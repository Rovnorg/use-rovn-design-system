# Rōvn document system

A shared agent skill and local renderer for purpose-specific documents. Create PDF and source-editable HTML, export supported narrative content to Word, and use explicit presentation and workbook models for PowerPoint and Excel.

This is a fork of [jkou-cmd/use-rovn-design-system](https://github.com/jkou-cmd/use-rovn-design-system), extending its original Paper-derived report renderer. It is public on GitHub, but **does not carry a blanket open-source license**. Read [attribution and usage restrictions](NOTICE.md), especially for brand imagery.

## Supported scope

| Route | Scope |
| --- | --- |
| Professional narrative → PDF / HTML | Memo, letter, business plan, report, board paper, proposal, legal text, SOP, case study and pricing |
| Narrative v2 → DOCX | Native paragraphs, headings, tables, links, notes and page fields; unsupported structures are rejected |
| Presentation v2 → PPTX | Five fixed 16:9 layouts with native text, tables, shapes and speaker notes |
| Workbook v2 → XLSX | Typed cells, sheets, number formats, formulas and explicitly supplied cached results |
| Original `report-v1` → PDF / HTML | Original Paper report, including its cover, section numbering, imagery and dark-page controls |

The [research taxonomy](docs/research/document-taxonomy.json) maps 200 document types across 21 families. It is a routing resource, not a claim that every type or extension is implemented. See the [resource catalog](docs/research/research-and-resource-catalog.md) and [file-format map](docs/research/file-format-landscape.md) for specialist routes.

## Setup

Prerequisites:

- Node.js 22 or newer and npm.
- Poppler's `pdfinfo` on `PATH` for professional PDF generation; `pdftoppm` for actual-page PNG previews and the complete test suite.
- A supported local environment for Playwright Chromium. Browser system libraries may need installation on Linux.

```sh
git clone https://github.com/Rovnorg/use-rovn-design-system.git
cd use-rovn-design-system
npm ci
npm run setup
npm test
```

`npm run setup` installs Playwright Chromium, not Poppler, desktop Office, or Office fonts. After setup, bundled assets work offline. Normal rendering needs no Paper connection or paid model API. The invoking agent performs any separately requested content editing; this package is a repository skill and CLI, not a hosted service or MCP server.

## Use with agents

Start Codex or Claude Code in this checkout:

- Codex: `$use-rovn-design-system Turn examples/professional/executive-memo.md into a PDF and editable Word document. Preserve the content and review the outputs.`
- Claude Code: `/use-rovn-design-system examples/professional/executive-memo.md — create a PDF and editable Word document.`

The canonical skill is [`.agents/skills/use-rovn-design-system/SKILL.md`](.agents/skills/use-rovn-design-system/SKILL.md). The [Claude entry point](.claude/skills/use-rovn-design-system/SKILL.md) delegates to it. If discovery does not refresh after cloning, start a new session in this checkout.

To share it across projects or agent tools, keep one complete checkout and point each agent at its canonical skill by absolute path:

> Read `/absolute/path/use-rovn-design-system/.agents/skills/use-rovn-design-system/SKILL.md` and use that checkout to render my document. Preserve the supplied content, select the appropriate family, and review every output page.

Do not copy only `SKILL.md`: its relative references require the full repository, renderer, fonts and assets. A chat-only agent needs a local runner with file and command access. This repository does not change global agent configuration automatically.

## Generate documents

Run commands from the repository root. Markdown and DOCX input use the professional route by default; prepared v1 JSON retains its legacy route unless explicitly migrated.

```sh
# Prepare and inspect a narrative model, then produce PDF and actual-page PNGs.
node scripts/render.mjs examples/professional/executive-memo.md --prepare output/working/memo.json
node scripts/render.mjs output/working/memo.json --out output/memo.pdf --screenshots

# Export native editable formats with the appropriate model.
node scripts/export-office.mjs output/working/memo.json --out output/memo.docx
node scripts/export-office.mjs examples/professional/pilot-deck.json --out output/pilot.pptx
node scripts/export-office.mjs examples/professional/pricing-workbook.json --out output/pricing.xlsx

# Select the original report layout explicitly when wanted.
node scripts/render.mjs examples/sample.md --layout report-v1 --dark-pages off --out output/original-report.pdf
```

PDF rendering also writes a self-contained HTML source and `.qa.json`. `--screenshots` adds PNGs of actual PDF pages. Choose `--family proposal` (or another supported family) when automatic classification is unsuitable. See [narrative fields and commands](docs/document-model.md), [Office schemas](docs/office-formats.md), and the [legacy report guide](.agents/skills/use-rovn-design-system/LEGACY_REPORT.md).

The original report's dark pages, lettered sections, fixed artwork and Lucide callouts are layout-specific, not universal document defaults. Explicit Paper-template updates use the [sync procedure](docs/paper-sync.md). Responsive websites and app layouts are outside this renderer's scope.

## Examples and verification

The [professional example library](examples/professional/) contains synthetic narrative, presentation and workbook inputs. The legal reference is a clearly attributed excerpt with [source provenance](examples/professional/sources/commonpaper-nda/PROVENANCE.md), not a complete or signing-ready agreement.

```sh
node scripts/build-professional-gallery.mjs output/gallery
```

The [dated validation record](docs/validation.md) separates automated checks, actual-page review, native application checks and remaining limits. The professional upgrade's complete suite passed 30 tests; its ten narrative samples produced 22 reviewed PDF pages. These are bounded sample results, not universal quality or compatibility guarantees.

Important limits:

- Word export rejects unsupported images, cards, callouts and table-layout options. DOCX import is not lossless round-trip editing.
- Slides and workbooks require their own models; arbitrary prose is not silently converted into slides or cells. ExcelJS writes supplied formula caches and does not recalculate them.
- Native Office fonts are declared, not embedded. Installed fonts and target-application review determine visual fidelity.
- Professional PDF notes are linked endnotes. No PDF/A, PDF/UA, PDF/X, assistive-technology conformance or legal signing-readiness certification is claimed.
- Four transitive dependency audit findings remain in the dated audit. The [Office documentation](docs/office-formats.md) records advisories and supported-path constraints; this is not a clean security audit.

Review every actual page, preserve source content and evidence, and disclose unsupported requirements. Public examples do not establish company traction, commercial terms, approvals or policy.

To update a clean checkout, use `git pull --ff-only`, then `npm ci`; rerun browser setup when Playwright changes. Preserve local changes before updating.
