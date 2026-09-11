# Validation record

## Professional upgrade — bounded validation, 11 September 2026

This fork extends baseline `f00d0183e6353d5953c2a4a7dca700c68da1a5b1`. The evidence below records local testing of that extension before public packaging, not an upstream release, hosted CI result or universal A+ verdict. The review found and corrected content omissions, unsupported-field acceptance, unsafe local-image traversal, Word field/hierarchy defects, and presentation overflow. Do not infer universal acceptance from a generated file or a green unit test alone.

On Windows, Node 24.14.0 and Chromium 153.0.8010.12: the complete repository suite passed 30/30; after final family-spacing changes, the affected professional/integration suite passed 11/11. Ten narrative examples generated PDF, HTML, normalized JSON and native DOCX; the explicit presentation and workbook examples generated PPTX and XLSX. There were no generation failures in the final gallery run.

The final narrative gallery has 22 actual PDF pages: memo 1, letter 1, pricing 1, case study 1, plan 6, report 3, proposal 2, board 2, SOP 2, legal reference 3. All pages were visually reviewed. An independent extraction check found no missing supplied phrases or text outside page bounds. This check is phrase-presence/bounds evidence, not exact equality, reading-order proof or a guarantee against every clipping case.

A separate same-source behavioral test opened the memo in Microsoft Word 16.0 read-only and updated all fields: one Letter page, no unwanted contents list, working PAGE field displaying 1, sender and all supplied body content preserved. Its actual PDF and Word-rendered PDF were visually reviewed. Word substituted Cambria/Cambria-Bold for missing fonts; exact native brand typography is not established. This test did not perform an edit/save round trip.

The final six-slide PPTX and three-sheet XLSX were rendered in LibreOffice 26.2.3.2 and every preview page was reviewed. Those are LibreOffice checks, not Microsoft PowerPoint/Excel visual-equivalence proof. A separate Microsoft Excel synthetic in-memory formula check recalculated A2=7 with B2=A2*2 to 14 and closed without saving. ExcelJS itself only writes supplied cached values.

Reproduce candidates with `node scripts/build-professional-gallery.mjs OUTPUT_DIRECTORY`; retain source, package and preview hashes. Private machine-specific installation records and native-application preview artifacts are not included in this public package. Consequently, the historical manual checks are reported observations, not independently reproducible evidence contained in the repository. Rerun target-application checks for each delivery environment.

The research taxonomy and file-format inventory are intentionally broader than implemented adapters. They do not claim ODT/RTF/EPUB, signed or fillable PDF, compliance profiles, macros, structured regulatory submissions, or responsive application layouts are implemented. Office fonts are declared but not embedded; installed-font and native-editor checks remain separate.

Professional PDF notes are linked endnotes, not page footnotes. DOCX rejects unsupported image/callout/card and table-layout features. Presentation geometry checks reject content beyond fixed boxes instead of shrinking or dropping text. Four transitive dependency audit findings remain (two high, two moderate); see [Office formats](office-formats.md) for advisories and supported-path reachability constraints. No clean-security-audit, assistive-technology, PDF/A, PDF/UA, PDF/X or signing-readiness claim is made.

## Public-package reproduction — 11 September 2026

A separate publication worktree installed dependencies with `npm ci`, ran `npm run setup` using the same host's browser cache, and passed all 30 tests. The README commands produced a one-page memo PDF and actual-page PNG, plus native DOCX, PPTX and XLSX packages. The memo page was visually reviewed. This is a separate-worktree reproduction using existing system tools, not a clean-machine or cross-platform certification. The publication pass did not repeat the historical native Office checks above.

Relative documentation links and the skill frontmatter were checked. A targeted scan of candidate source files found no matching private-machine paths or supported credential patterns; this is not an exhaustive secret or security audit. The public package omits machine-specific installation records and private company records. It retains upstream and third-party notices without adding a blanket license.

The dated evidence below describes the original `report-v1` only. It must not be reused as proof for the new professional or Office adapters.

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
npm run render -- examples/sample.md --layout report-v1 --screenshots
```

The Python comparison requires Pillow and NumPy. It is separate from `npm test` so normal generation does not require Python. PDF visual inspection can use `pdftoppm`; PDF structure can be inspected with `pypdf`.

## Boundaries

- The invoking agent performs permitted light editing and component selection. The renderer does not call a model or rewrite facts. Its preservation check covers pagination, not editorial changes made before rendering.
- Oversized fixed cover copy, unsupported Word objects/equations, very long footnotes, or unsplittable components produce actionable errors. Editorial restructuring must preserve the original content.
- Arbitrary new fonts, non-Latin scripts, emoji, and new component designs have not been validated. The original list-circle and footer-dot symbols are bundled Paper exports to avoid operating-system fallback for those specific glyphs.
- At the time of this historical report-v1 validation, no slide-deck renderer was implemented. The professional extension now has the separate, bounded [PPTX adapter](office-formats.md); historical report checks do not validate it.

## Research-report regression

The supplied nursing-onboarding Markdown was rendered as 26 pages: cover, two contents pages, 14 body pages (three dark), and nine appendix pages. An independent preparation check retained all 142 original non-separator content blocks. The renderer verified 376 content fields after pagination. The PDF has 37 contents-link annotations and retains the supplied statistics, quotations, and inference/method caveats.

This report exposed three layout/import cases now handled in the shared renderer: Notion `<aside>` callouts, long contents labels wrapping before page numbers, and bibliography entries staying intact when they fit on a fresh page. Footer SVG overflow is explicitly visible to prevent the original tightly bounded logo from clipping at its edge; the 56 px logo and its position are unchanged. All 25 footer logos were checked with at least 16 px right clearance, and the final PDF pages were rendered with Poppler and visually reviewed. Eight automated tests pass, including Notion callouts, fenced HTML preservation, long contents labels and intact bibliography entries.

The report's original research was formatted, not independently fact-checked. Three linked child reports were not attached. Their Notion links were reconstructed from the exported page IDs, but their contents were not incorporated or their accessibility verified. The source, prepared model, and editorial record remain under `output/working/`.

## Version 0.2 controls

Eleven automated tests cover contextual and explicit Lucide icon selection, invalid-name rejection, icon-free callouts, Markdown/prepared dark-page settings, and CLI overrides in both directions. Equivalent light-only and mixed-theme reports retain the same page count and content fields. SVG shape counts, 24 px size, inherited stroke colors and dark palette values are checked; light and dark callout renders were also visually reviewed. Lucide is pinned to 1.43.0, and only used icons are embedded in output.
