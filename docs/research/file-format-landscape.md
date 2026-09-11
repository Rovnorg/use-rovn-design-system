# Document files: coverage and boundaries

Research map · 11 September 2026. This is a format inventory and selection policy, not a claim that every extension below has been implemented or certified.

A **document type** is its job: memo, agreement, plan, invoice, manual. A **file format** is its container: DOCX, PDF, XLSX, EPUB. A single document may need an editable original, a fixed-layout delivery copy, and structured data. These are different artifacts with different checks.

| File family | Formats to recognize | Appropriate role | Required checks and current upgrade direction |
| --- | --- | --- | --- |
| Plain and lightweight text | TXT, MD/Markdown, CSV, TSV | Source writing, simple records and data exchange | Encoding, newline/delimiter rules, escaping, types and source completeness. Markdown is the narrative input; tabular exports require a declared schema. CSV does not carry workbook styling, sheets or formula behavior. |
| Word processing | DOCX, ODT, RTF; legacy DOC; Apple Pages | Editable letters, memos, plans, agreements and reports | Styles, sections, lists, notes, tables, bookmarks, images and application rendering. Native DOCX is the first adapter. ODT/RTF/Pages require a verified conversion route, not a renamed file. |
| Fixed-layout delivery | PDF; PDF/A, PDF/UA, PDF/X profiles | Distribution; archival, accessible or print-production delivery when a specific profile is required | Correct pages, fonts, text, links, reading order and visual inspection. Ordinary PDF generation does not prove compliance with any profile. Use a dedicated validator for the requested profile. |
| Presentations | PPTX, ODP, Keynote; PDF companion | Pitch, board, training, sales and conference decks | Slide-specific hierarchy, native editable objects, speaker notes, reading order, overflow and actual target-application rendering. Native PPTX uses an explicit slide model. |
| Spreadsheets | XLSX, ODS; CSV/TSV exchange; legacy XLS | Financial models, trackers, schedules, registers and tabular analyses | Typed inputs, units, formulas, independent reconciliation, cached results, recalculation, print areas and accessibility. Native XLSX must not pretend the generator calculates formulas. |
| Reusable templates | DOTX, POTX, XLTX; OTT, OTP, OTS | Repeated authorized production with controlled structure | Template-specific package types, master styles, placeholders and repeat-run tests. Ordinary document exports are not automatically genuine templates. |
| Macro-enabled files | DOCM, DOTM, XLSM, XLTM, PPTM, POTM | Existing trusted automation when specifically required | Separate executable-code review and explicit need. Not a default output. Never execute embedded macros or carry them through without inspection. |
| Web and collaborative documents | HTML, browser-native Google Docs/Sheets/Slides, cloud application records | Browser reading, collaboration and living documents | Semantic structure, keyboard behavior, permissions, persistence, versioning and export fidelity. Local HTML is not a hosted collaborative editor. Upload or publication requires separate authority. |
| Books and publications | EPUB, HTML, PDF; LaTeX/TeX, DocBook XML, JATS XML, TEI XML | Reflowable books, scholarly manuscripts, technical publishing and archival text | Publication-specific schema, navigation, citations, equations, accessibility and issuer requirements. Specialist routes are deferred, not flattened to a generic report. |
| Structured business records | JSON, XML/UBL, XBRL/iXBRL, EDI | Machine-readable records, trade interchange and financial reporting | Exact vocabulary/version, schema validation, identifiers, reconciliation and recipient acceptance. A visual invoice or financial table is not a valid structured submission. |
| Forms and signed records | DOCX forms, HTML forms, PDF AcroForms, signed PDF, issuer-specific packages | Intake, applications, approvals and formal records | Field names, labels, validation, tab order, retention, exact issuer format and signature integrity. A drawn line is not an electronic-signature service. No generic form-submission authority. |
| Diagrams and design originals | SVG, draw.io XML, VSDX, AI, INDD/IDML, design-platform records | Editable diagrams, publication masters and supporting illustrations | Text editability, geometry, fonts, linked assets, accessibility and license rights. These need their own design adapters; a screenshot is only a preview. |
| Raster and scanned documents | PNG, JPEG, TIFF; image-only PDF | Source evidence, archival scans and previews | Resolution, OCR accuracy, rotation, completeness and source provenance. OCR text requires checking; an image of a spreadsheet is not an editable spreadsheet. |
| Message and handoff records | EML, MSG, MBOX; ZIP with manifest | Original correspondence or an evidence-preserving package | Headers, attachments, timestamps, hashes and access controls. Creating a local package does not send it or verify recipient delivery. |

## Resource basis

- [OASIS OpenDocument 1.4 introduction](https://docs.oasis-open.org/office/OpenDocument/part1-introduction/OpenDocument-v1.4-os-part1-introduction.html) provides the open office-format architecture. Its existence does not establish support in every editor or converter.
- [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/) defines Office Open XML structures and packaging. Package inspection complements, but does not replace, native application testing.
- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) documents common CSV conventions; real recipients can require a different dialect, encoding or delimiter.
- [W3C EPUB 3.3](https://www.w3.org/TR/epub-33/) is the publication-format reference for an eventual reflowable-book adapter.
- [PDF Association's standards map](https://pdfa.org/pdf-standards/) distinguishes general PDF from archival, accessibility and print standards. The correct profile must be selected and tested explicitly.
- [Library of Congress format research](https://loc.gov/preservation/digital/formats/index.shtml) and its [RTF description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000473.shtml) inform preservation and legacy-format handling; they are not blanket endorsements of conversion fidelity.

These are reference resources. Their standards and documentation retain their own rights. No paid standard, vendor asset, or copyrighted template is redistributed by this inventory.

## Selection rule for the agents

1. Identify the reader, task, recipient requirements and source authority.
2. Choose the document family and its appropriate structure.
3. Choose the editable source, delivery copy and any structured companion separately.
4. Use the implemented adapter only within its tested component scope. If the format is specialist or prescribed, use the proper tool/template and disclose its limits.
5. Verify the actual files. Never rename an extension, flatten editability, silently drop a component, or call an unvalidated output compliant.

Start with [the document taxonomy](document-taxonomy.json) and [the resource catalog](research-and-resource-catalog.md). The implementation's final validation record, not this inventory, determines which outputs are ready for use.
