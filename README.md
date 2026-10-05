# Rōvn document system

Create professional documents around the reader and occasion. The current design
uses the original Rōvn mark, expressive Crimson Pro typography, pure-white
reading surfaces and deliberate amber.
Read [the design direction](docs/design-direction.md) before creating a file.

## Choose the document

Use [the narrative model](docs/document-model.md) for memos, letters, plans,
reports, board papers, proposals, legal text, SOPs, case studies and pricing.
Use [Office formats](docs/office-formats.md) for native Word, PowerPoint and Excel.
The [taxonomy](docs/research/document-taxonomy.json) and
[resource catalog](docs/research/research-and-resource-catalog.md) help choose
references and specialist routes; they do not claim every format is implemented.

A substantial new document needs a short design brief: reader, occasion, action,
page budget, reference comparison and chosen composition. The invoking agent
performs research and art direction. The deterministic renderer preserves content
and applies the selected supported layout; it does not judge which design is best.

## Setup

Requires Node.js 22 or newer, locked dependencies, Playwright Chromium and
Poppler `pdfinfo` on PATH. Actual PDF page PNGs additionally require `pdftoppm`.
Native Office visual checks require the relevant desktop application and fonts.

```sh
npm ci
npm run setup
```

Run the installed skill by its full path or invoke `$use-rovn-design-system` in
Codex, `/use-rovn-design-system` in Claude Code. Keep the full repository and
assets available. The canonical skill is in `.agents/skills/`; the Claude wrapper
is in `.claude/skills/`. No paid model API or Paper connection is needed to render.

## Render and inspect

```sh
node scripts/render.mjs examples/professional/executive-memo.md --prepare output/memo.json
node scripts/render.mjs output/memo.json --out output/memo.pdf --screenshots
node scripts/render.mjs source.md --family proposal --out output/proposal.pdf --screenshots
node scripts/export-office.mjs output/memo.json --out output/memo.docx
node scripts/render.mjs examples/professional/brand-editorial.json --out output/brand-editorial.pdf --screenshots
node scripts/build-professional-gallery.mjs output/gallery
npm test
```

Each narrative PDF has self-contained HTML, a QA record and optional PNGs of its
actual pages. Source-editable HTML is not a word processor. Ordinary Markdown,
DOCX and JSON inputs all select the professional route. Supplied content is never
rewritten merely to fit a layout. Unsupported legacy features require an explicit
supported adaptation rather than silently returning to the old design.

## Current visual contract

- White surfaces only: no paper grain, cream, ivory, beige, warm gradients or
  off-white document elements.
- The original Rōvn logo, Crimson Pro display type and precise Inter body text carry the identity.
- Amber supports the mark, section numerals and selected emphasis. A bounded ink or amber callout is available; do not blanket pages or tables with it.
- Useful layout differences: split memo masthead, board reading rail, strong
  proposal opening, editorial reports, numerical pricing, conventional legal text.
- Preserve source wording, figures, qualifiers, references and formal labels.
- Review every actual PDF page or slide. Check readability, content, page breaks,
  table continuation, links, fonts and output in its intended application.
- A green build is not visual approval, accessibility certification or permission
  to send. [Validation](docs/validation.md) records tested scope and limitations.

## Historical reproduction

The old Paper-derived renderer remains available with explicit
`--layout report-v1` for archival reproduction and reference tests only. It is
retired for new Rōvn deliverables. Its amber image headers, paper palette, lettered
section openers and dark-page settings are not current design guidance. See
[the archived guide](.agents/skills/use-rovn-design-system/LEGACY_REPORT.md) and
[v1 schema](docs/document-model-v1.md) when reproducing a historical artifact.
[Paper sync](docs/paper-sync.md) concerns original template capture, not automatic
adoption of that visual style.

## Licensing and installation status

Lucide attribution is in `licenses/lucide.txt`. Font licenses are bundled under
`assets/fonts/`. Supplied imagery remains project-use restricted; this repository
grants no additional redistribution rights. This fork extends Jerry’s original repository. Publication on a Rōvn branch
is not acceptance into Jerry’s upstream or universal format/quality certification.
See [attribution and usage restrictions](NOTICE.md).
