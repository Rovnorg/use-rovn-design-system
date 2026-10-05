# Validation record

## Editorial document upgrade — 3 October 2026

This revision restores the original Rōvn mark and editorial typography on pure-white
reading surfaces. It adds real normal/italic variable-font registration, distinct
family compositions, deliberate amber, optional authored emphasis panels, and
renderer provenance covering code, styles, logo and embedded fonts. The skill
selects a composition for the reader and occasion before rendering. Ordinary
prepared JSON no longer selects the historical report layout implicitly.

### Verified scope

- Full repository suite: 36/36 passed; after final native metadata/font-preflight
  polish, affected Office suite: 8/8 passed.
- Eleven narrative fixtures produced 22 PDF pages: memo 1, letter 1, pricing 1,
  case-study 1, business-plan 5, report 3, proposal 2, board 2, SOP 2, legal 3,
  plus the one-page brand specimen. Every page was inspected.
- Independent extraction found all 403 checked source fields and no text outside
  page bounds. This checks phrase presence, not exhaustive semantic equality.
  Intentional CSS uppercase on the specimen eyebrow was accounted for.
- All 33 HTML width checks passed at 390, 768 and 1280 pixels. Wide tables scroll
  inside their containers on mobile; the document canvas remains white.
- Regression checks cover reader-action routing, legacy-input routing, original
  logo presence, variable/italic font registration and emphasis-panel contrast.
- A read-only reviewer found no material blocker in the inspected final PDF/HTML
  fixtures. This is bounded evidence, not a universal aesthetic or format grade.

### Reproduce the candidates

```sh
npm ci
npm run setup
npm test
node scripts/build-professional-gallery.mjs output/gallery
node scripts/render.mjs examples/professional/brand-editorial.json --out output/brand-editorial.pdf --screenshots
```

PDF inspection also requires Poppler. Keep generated source, PDFs, page PNGs, QA
records and artifact hashes together. Task-specific local evidence and private
working documents are intentionally not part of this repository. The bundled
fixtures are synthetic, except the attributed and pinned Common Paper reference.

### Editable-format limits

The final memo was rendered in Microsoft Word 16.0.20430.20092. Its logo and layout
were inspected; Word substituted Calibri/Cambria for missing desktop fonts. The
six-slide presentation and three-page workbook were rendered and inspected in
LibreOffice 26.2.3.2; the presentation display face was substituted with DejaVuSans.
These checks do not establish exact native brand-font fidelity or Microsoft
PowerPoint/Excel visual equivalence. Matching desktop fonts are required. PDF/HTML
embeds the intended faces and is the visual reference.

Office packages contain native editable text, tables and values, but do not embed
the declared fonts. ExcelJS writes supplied cached formula results; it does not
calculate formulas. Professional PDF renders linked endnotes, not page-associated
footnotes. Accessibility, PDF/A, PDF/UA, PDF/X and execution-readiness certifications
are not claimed. Unsupported components fail explicitly; see [Office formats](office-formats.md).

This supersedes the rejected warm-paper and sterile tiny-accent design directions.
The original source captures remain unchanged. Publication on a Rōvn branch does
not imply acceptance into Jerry's upstream or deployment to existing live surfaces.
The historical validation below concerns only the explicit `report-v1` route.

## Historical report-v1 evidence

Validated on 2026-09-08 with Node.js 22+ and the pinned Playwright Chromium 153.0.8010.12 on macOS. Dependency versions are locked in `package-lock.json`.

## Design fidelity

All 17 selected Paper frames are captured as original inline JSX and PNG references. Every remote image is mapped to local assets. The reference renderer uses the same font alias resolution, whole-pixel line heights, and captured symbol glyphs as the report renderer.

After converting Paper's Display P3 references to sRGB, mean absolute RGB-channel differences range from **0.1780 to 0.6318 out of 255**. Pixels whose largest channel difference exceeds 20 account for **0.0274% to 0.3567%** of each frame. [Per-frame results](../design/paper/reference-comparison.json) are retained. The comparison command fails above 0.75 average channel difference or 0.5% significant pixels; visual review remains required.

These measurements compare the complete original templates with the same sample copy. They validate the template extraction, fonts, artwork, and normalization; they do not prove that every possible new document is laid out correctly. New reports use those component subtrees with variable content and measured pagination. Fonts, sizes, colors, geometry and component styling remain template-controlled. Raster output can differ across PDF viewers and operating systems.

## Functional checks

`npm test` passes seven tests covering:

- Stable IDs through prepared-content editing, section numbering through AA and beyond.
- Markdown heading/list structure, links, emphasis, exact code, footnotes, and explicit references.
- DOCX title/section, bold text and table import using a real minimal DOCX fixture.
- Unsupported component rejection, inline sanitization, local image embedding and amber-image restrictions.
- A sample with eight body pages, two dark pages, fixed ToC/appendix artwork, image columns and the 377 px image band.
- A long report with a multi-page ToC and appendix, 27 main sections, long prose, 35 table rows, split cards, and 150 lines of code. All content fields survive pagination; literal code preserves whitespace. Table headers repeat, ToC labels resolve to target page numbers, footnotes stay with citations, and dark pages remain nonadjacent and within the requested fraction.

The sample PDF has 12 physical pages: cover, two ToC pages, eight body pages, and appendix. Printed numbering starts at 1 on the first ToC page. Its PDF page boxes are 612 × 792 points, and its contents links are actual PDF link annotations. The HTML includes local fonts and imagery as data URLs and has no runtime JavaScript after export. PDF text is selectable; Chromium may embed variable-font glyphs as Type 3 outlines rather than named TrueType font subsets.

## Reproduce

```sh
npm ci
npm run setup
npm run build:templates
npm test
node scripts/verify-reference.mjs
python3 scripts/compare-reference.py --check
npm run render -- examples/sample.md --screenshots
```

The Python comparison requires Pillow and NumPy. It is separate from `npm test` so normal generation does not require Python. PDF visual inspection can use `pdftoppm`; PDF structure can be inspected with `pypdf`.

## Boundaries

- The invoking agent performs permitted light editing and component selection. The renderer does not call a model or rewrite facts. Its preservation check covers pagination, not editorial changes made before rendering.
- Oversized fixed cover copy, unsupported Word objects/equations, very long footnotes, or unsplittable components produce actionable errors. Editorial restructuring must preserve the original content.
- Arbitrary new fonts, non-Latin scripts, emoji, and new component designs have not been validated. The original list-circle and footer-dot symbols are bundled Paper exports to avoid operating-system fallback for those specific glyphs.
- No slideshow or slide-deck renderer is implemented. The content model and assets are separated from the report template for a future format adapter.

## Research-report regression

The supplied nursing-onboarding Markdown was rendered as 26 pages: cover, two contents pages, 14 body pages (three dark), and nine appendix pages. An independent preparation check retained all 142 original non-separator content blocks. The renderer verified 376 content fields after pagination. The PDF has 37 contents-link annotations and retains the supplied statistics, quotations, and inference/method caveats.

This report exposed three layout/import cases now handled in the shared renderer: Notion `<aside>` callouts, long contents labels wrapping before page numbers, and bibliography entries staying intact when they fit on a fresh page. Footer SVG overflow is explicitly visible to prevent the original tightly bounded logo from clipping at its edge; the 56 px logo and its position are unchanged. All 25 footer logos were checked with at least 16 px right clearance, and the final PDF pages were rendered with Poppler and visually reviewed. Eight automated tests pass, including Notion callouts, fenced HTML preservation, long contents labels and intact bibliography entries.

The report's original research was formatted, not independently fact-checked. Three linked child reports were not attached. Their Notion links were reconstructed from the exported page IDs, but their contents were not incorporated or their accessibility verified. The source, prepared model, and editorial record remain under `output/working/`.

## Version 0.2 controls

Eleven automated tests cover contextual and explicit Lucide icon selection, invalid-name rejection, icon-free callouts, Markdown/prepared dark-page settings, and CLI overrides in both directions. Equivalent light-only and mixed-theme reports retain the same page count and content fields. SVG shape counts, 24 px size, inherited stroke colors and dark palette values are checked; light and dark callout renders were also visually reviewed. Lucide is pinned to 1.43.0, and only used icons are embedded in output.
