# Narrative document model

The professional route uses `schemaVersion: 2`, `kind: "document"`. It separates content from document-family layout. Follow [the current design direction](design-direction.md): white surfaces, near-black information, amber only as an accent. All ordinary input formats, including old prepared JSON, now select this route. The [original v1 model](document-model-v1.md) and explicit `--layout report-v1` are retained only for archival reproduction. Legacy features the professional model cannot preserve must be adapted explicitly, not silently dropped.

## Select a family

| Family | Reader's task | Structural expectation |
| --- | --- | --- |
| `memo` | Understand and decide | Compact masthead, decision first, continuous short sections |
| `letter` | Receive correspondence | Sender, recipient, subject, greeting and supplied closing |
| `business-plan` | Evaluate choices and execution | Assumptions, market, operations, economics and risks |
| `report` | Understand evidence | Question, method, findings, limitations and references |
| `board` | Prepare a governance decision | Recommendation, options, risks and authority |
| `proposal` | Evaluate an engagement | Scope, deliverables, exclusions and supplied terms |
| `legal` | Read supplied formal terms | Conventional flow, exact labels, no invented terms |
| `sop` | Perform a controlled process | Prerequisites, owners, ordered steps and exceptions |
| `case-study` | Evaluate an intervention | Context, action, evidence, outcome and limitations |
| `pricing` | Compare commercial scope | Units, included/excluded work and comparable prices |

These are layout families, not drafting authority or exhaustive templates. The [taxonomy](research/document-taxonomy.json) covers additional types and specialist routes. Automatic classification is a fallback; review its reasons and override it where necessary. The classifier considers explicit family, authored clauses, document title, purpose, reader action and audience; incidental body terms cannot select a family. The invoking agent researches references and records its design rationale. A classifier cannot perform art direction.

## Input and commands

Markdown supports headings, paragraphs, lists, tables, code, links, images and notes through the existing parser. Use YAML frontmatter for `title`, `family`, and supplied metadata. DOCX import uses Mammoth and is not a faithful round-trip editing service.

Professional v2 supports four nested heading levels beneath a section (HTML h3–h6, following the document h1 and section h2). Unusual sources needing a fifth nested level are rejected without producing a file; restructure only with author agreement or use a specialist route. The original v1 route is unchanged.

```sh
node scripts/render.mjs examples/professional/executive-memo.md --prepare output/working/memo.json
node scripts/render.mjs output/working/memo.json --out output/pdf/memo.pdf --screenshots
node scripts/render.mjs source.md --family proposal --out output/pdf/proposal.pdf
node scripts/render.mjs examples/sample.md --layout report-v1 --dark-pages off --out output/pdf/original.pdf
```

Professional PDF generation needs `pdfinfo` on PATH; actual-page PNGs additionally need `pdftoppm`. These Poppler tools are separate from the npm/browser setup. Office commands and separate presentation/workbook schemas are in [Office formats](office-formats.md). Check supported components before requesting an export.

## Schema v2

```json
{
  "schemaVersion": 2,
  "kind": "document",
  "metadata": {"title":"Decision requested","author":"Supplied author"},
  "intent": {"family":"memo","audience":"Review committee","purpose":"Decision"},
  "sections": [{"id":"decision","title":"Decision requested","blocks":[
    {"type":"paragraph","text":"The supplied request, with **emphasis**."},
    {"type":"key-values","items":[{"label":"Owner","value":"Supplied owner"}]}
  ]}],
  "footnotes": {},
  "sources": [],
  "appendix": []
}
```

Metadata supports title, subtitle, author, date, version, recipient, sender, subject, confidentiality, eyebrow, summary and smallPrint. Never invent a legal effective date, approval, author or version. Intent may include audience, purpose, readerAction, readingMode, designRationale, editable and confidentiality. Keep the reference comparison in the accompanying design brief. Router reasons are diagnostic metadata, not content or evidence. Unknown document, metadata, intent and section fields are rejected.

Sections contain a string title (empty for untitled prose), stable optional ID, blocks, and optional boolean `pageBreakBefore`. Supplied IDs must be unique. `html` is sanitized inline markup and takes precedence over `text`; edit the active field. Ordinary `text` is inline Markdown; code text is literal. Legal labels are supplied strings. Local links use `#id` and must resolve. Migration from v1 removes report-generated section letters, subsection counters and Paper table-style variants; the selected professional family supplies its own styling. Supplied heading text, list markers, legal labels and cell contents remain. Use `report-v1` when its precise presentation contract is required.

| Block | Fields |
| --- | --- |
| `paragraph`, `lead` | `text` or `html` |
| `heading` | `text`, integer `level` 1–4 beneath the section heading |
| `list-item` | `text`/`html`, supplied `marker`, `depth` |
| `table` | `headers`, rectangular `rows`; optional `caption`, `widths`, `orientation`, `columnTypes`, `note` |
| `code` | literal `text`, optional `language` |
| `clause` | exact `label`, optional `title`, `text`/`html` |
| `definition-list` | `items: [{term, definition}]` |
| `key-values` | `items: [{label, value}]` |
| `signature` | `parties: [{name, role?, organization?}]`, optional `caption` |
| `page-break` | explicit break, no content |
| `callout`, `cards`, `image`, `image-column`, `image-band`, `rule` | Existing shapes where supported by the selected adapter |

An adapter must reject a component or option it cannot preserve. A field in this shared model does not establish support in every output. Captions, notes, emphasis and links are content. Table orientation or weights must not be silently ignored where they affect readability.

Signature blocks supply blank presentation lines, not identity, authority, consent, signing status or electronic-signature validity.

Note definitions are inline HTML keyed by ID; references use `<span data-note="1">1</span>`. Professional PDF currently uses linked **endnotes**, not page-associated footnotes. Use a supported Word or specialist path when page footnotes are required, or obtain agreement to the endnote treatment. Keep every reference and definition; do not describe endnotes as page footnotes.

Sources contain `title` and optional `item`, `url`, `label`, `description`. Keep supplied bibliographic details and qualifiers. Appendices are supplied blocks, not automatically generated research.

## Evidence and limits

Use [validation](validation.md) for tested behavior and [professional examples](../examples/professional/) for synthetic sources. Long tables, nested structures, citations, code, non-Latin text, equations, embedded objects, editable forms and prescribed formats need explicit capability checks. A short sample does not prove their support.

Source-editable HTML is not a browser word processor. Native Office packages still require native visual review and installed fonts. Ordinary PDF export does not establish PDF/A, PDF/UA or PDF/X conformance.
