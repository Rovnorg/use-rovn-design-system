# Native editable Office formats

`src/office.mjs` exports `renderOffice(doc, { out, format })` for native `.docx`, `.pptx`, and `.xlsx` packages. It does not convert one model into another: each format has an explicit semantic v2 model and rejects unsupported source structures.

```sh
node scripts/render.mjs source.md --family memo --prepare output/working/memo.json
node scripts/export-office.mjs output/working/memo.json --out output/memo.docx
node scripts/export-office.mjs examples/professional/pilot-deck.json --out output/pilot.pptx
node scripts/export-office.mjs examples/professional/pricing-workbook.json --out output/pricing.xlsx
```

Use the Office export command, not the PDF command with a renamed extension. Office source files remain editable native packages; a companion preview is a separate artifact and must be labeled by the application that rendered it.

| Output | Model | Editable objects | Scope and limits |
| --- | --- | --- | --- |
| DOCX | Narrative v2: `kind: "document"` | Word paragraphs, headings, literal list markers, tables, hyperlinks, signatures, page breaks, footer page fields | Memo, proposal, report, plan, legal, letter, SOP, board and pricing families. Images/callouts/cards are rejected until a content-preserving Word adapter exists. TOC fields update in Word. |
| PPTX | Presentation v2: `kind: "presentation"` | PowerPoint text, table and shape objects; speaker notes | 16:9 title, section, two-column, data-table and closing layouts. No prose-to-slides inference. |
| XLSX | Workbook v2: `kind: "workbook"` | Excel sheets, headers, typed values, number formats and formulas | Formula cells use `{ "formula": "A2+B2", "result": 4 }`. `result` is a supplied cache, because ExcelJS does not calculate formulas. |

Before writing a PPTX, the adapter measures every declared text box with the bundled display/body metrics and a conservative line-height guard. It rejects unbreakable words, text that needs more lines than the fixed box, and tables whose measured row heights exceed the available slide area. It does not shrink text or make up additional slides.

## DOCX v2 boundary

The DOCX adapter accepts only the common v2 display model: top-level `schemaVersion`, `kind`, `metadata`, `intent`, `sections`, `footnotes`, `sources`, `appendix`, and generated diagnostic `routerReasons` (a string array). Metadata is limited to display fields: `title`, `author`, `date`, `version`, `subtitle`, `recipient`, `sender`, `subject`, `confidentiality`, `eyebrow`, `summary`, and `smallPrint`. Intent is limited to `family`, `audience`, `purpose`, `readingMode`, `editable`, and `confidentiality`; `editable` is boolean and the other optional fields are strings.

`author` is retained in the Word core property and is displayed separately from `sender`; metadata and intent confidentiality are separate visible values when both are supplied. A block heading has an integer `level` from 1 through 4: section titles use Word Heading 1 and block levels map to Word Heading 2 through Heading 5. Generated legacy `heading.number` is rejected, not silently removed. List `depth` is an integer 0–8; a supplied `marker` is a non-empty string and remains literal editable text. `pageBreakBefore` is boolean.

The adapter adds a Word contents field only for business-plan, report, and board documents with more than 900 counted content words. A memo, letter, proposal, pricing document, SOP, case study, or legal document never gets a contents field solely because it has several sections.

Ordinary `paragraph`, `lead`, `list-item`, and `clause` `text` is converted with the shared inline-Markdown parser before DOCX validation; literal code and heading text are not parsed as markup. Explicit `html` is deliberately narrow and validation happens before writing a package: `strong`, `b`, `em`, `i`, `code`, `s`, `strike`, `sup`, `sub`, `br`, `a[href]`, an inert `span`, and `span[data-note]`. Other elements or attributes are rejected rather than sanitized away. Thus raw `<img>` in ordinary Markdown text remains literal text, but an `img` element in explicit `html` is rejected. Code `language`, when supplied, is emitted as a visible language label immediately before the literal code paragraph.

## Presentation v2

The following is illustrative synthetic content, not Rōvn company metrics or contact information.

```json
{
  "schemaVersion": 2,
  "kind": "presentation",
  "metadata": { "title": "Board update", "author": "Example author" },
  "slides": [
    { "layout": "title", "title": "Board update", "subtitle": "September 2026", "notes": "Source notes." },
    { "layout": "two-column", "title": "Decisions", "left": { "heading": "Approved", "items": ["One"] }, "right": { "heading": "Open", "items": ["Two"] } },
    { "layout": "data-table", "title": "Metrics", "table": { "headers": ["Metric", "Value"], "rows": [["Pilots", "3"]] } },
    { "layout": "closing", "title": "Thank you", "contact": "contact@example.org" }
  ]
}
```

## Workbook v2

```json
{
  "schemaVersion": 2,
  "kind": "workbook",
  "metadata": { "title": "Pricing model" },
  "sheets": [{
    "name": "Model",
    "columns": [
      { "key": "price", "header": "Price", "type": "currency" },
      { "key": "units", "header": "Units", "type": "number" },
      { "key": "total", "header": "Total", "type": "formula" }
    ],
    "rows": [{ "price": 25, "units": 2, "total": { "formula": "A2*B2", "result": 50 } }]
  }]
}
```

Native Office generators name Rōvn’s approved families (`Crimson Pro`, `Inter Variable`, `Fragment Mono`) but do not embed their files. `Inter Variable` is the internal family name in the repository’s bundled Inter variable font. This is an Office-format limitation: Word, PowerPoint, and Excel render with the installed font on the recipient system. The exports never silently substitute a different declared font; visual portability therefore requires Office-usable versions of those fonts to be installed. The repository bundles Crimson Pro in TTF and Inter/Fragment Mono for web use, but PptxGenJS, docx and ExcelJS do not provide a tested cross-application embedding path.

The dependencies are pinned to `docx@9.5.1`, `pptxgenjs@4.0.1`, and `exceljs@4.4.0`, each MIT licensed. No PDF conversion is performed by this adapter.

`npm audit --omit=dev` on 2026-09-11 reports two high findings through PptxGenJS’s `image-size@1.2.1` ([GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)) and two moderate findings through ExcelJS’s `uuid@8.3.2` ([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). The current `image-size` latest release is still 2.0.2 and the official advisories list no patched release, while the audit’s ExcelJS suggestion is a downgrade; neither is a safe override. The presentation v2 schema deliberately has no image field and this adapter never calls `addImage`, so PptxGenJS’s image parser is outside the supported adapter path. ExcelJS invokes `uuid` only for conditional-formatting extension IDs, a feature this adapter does not use. Those are reachability constraints, not a clean-audit claim; do not pass untrusted image assets to a future image-capable PPTX adapter until its dependency path is remediated.
