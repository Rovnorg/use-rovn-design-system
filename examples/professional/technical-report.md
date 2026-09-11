---
family: report
title: Document preservation and export evaluation
subtitle: Methods, observations and limitations
author: Example research team
date: 2026-09-11
confidentiality: Synthetic research fixture
---
# Document preservation and export evaluation

## Abstract

This synthetic report defines a method for evaluating a document renderer. It tests source preservation, navigation, pagination and export usability. The numbers below are constructed test values, not measured product outcomes. The report deliberately includes footnotes, literal code, a dense table and a bibliography.

## Question and scope

Can one semantic source produce distinct professional files without losing the material that gives each document meaning? The question covers words, figures, qualifications, links and structural relationships. It also covers whether a reader can locate a decision, follow a clause reference or interpret a table after export.

A document can preserve all visible words and still change their meaning. Moving a qualification away from a metric can make the metric appear unconditional. A repeated table header can lose its association with the cells beneath it. A clause reference can retain its text while pointing to the wrong destination. The evaluation therefore treats content and relationships as separate concerns.[^method]

## Method

The test begins with an immutable source fixture. Preparation produces a typed content model with stable identifiers. Rendering produces final files and a receipt identifying the model, layout and exporter. The comparison checks the source against the model, then the model against each output. A reviewer inspects the rendered pages at normal reading size.

The source fixture includes a short memo, a long narrative, a legal-format example, a proposal and a numerical schedule. Each is tested with optional sections present and absent. A missing optional subtitle must not create an empty decorative panel. A missing required clause destination must produce a useful error.

### Literal preservation example

The following code must retain its whitespace, comparison operators and quoted string:

```js
const expected = 42;
const actual = rows.reduce((sum, row) => sum + row.count, 0);

if (actual !== expected) {
  throw new Error("Reconciliation failed: expected 42 records.");
}
```

### Navigation and source association

Hyperlinks are part of the content. A descriptive link to the [W3C tables tutorial](https://www.w3.org/WAI/tutorials/tables/) must remain clickable. A footnote's definition must remain available from the place where it is cited. References must retain supplied bibliographic details without invented author names, dates or publication titles.

## Illustrative observations

The following values are synthetic. They exercise numerical alignment and distinguish a count of checked fields from a claim about semantic correctness.

| Fixture | Source fields | Checks completed | Open observations |
| --- | --- | --- | --- |
| Executive memo | 12 | 12 | Reviewer must assess decision visibility |
| Legal-format sample | 28 | 28 | Clause and signature review still required |
| Business plan | 45 | 45 | Financial assumptions need independent checks |
| Technical report | 36 | 36 | Citation relationships require inspection |
| Proposal | 31 | 31 | Acceptance and commercial scope must agree |

The synthetic total is 152 source fields. That total is 12 + 28 + 45 + 36 + 31. A successful count check can identify missing or duplicated fields; it does not prove that a rendered chart, table or paragraph is useful to its reader.

### Long identifiers and links

The identifier `EXAMPLE-DOCUMENT-PRESERVATION-RECONCILIATION-2026-09-11-000042` must wrap without clipping or changing its characters. A long reference label must wrap before its page number rather than collide with it. Long organisation names must not force signature text outside the page boundary.

## Discussion

The most useful improvement is to choose a layout from the reading task. A memo's action should appear early. A technical report should expose method and limitations. An agreement should preserve its numbering and defined terms. A workbook should expose assumptions and formulas. These differences are structural; changing an image or accent colour does not establish them.

Export quality also depends on the recipient's software. A native Word file supports editing but can repaginate. A PDF fixes page geometry but still needs a sensible reading order. A spreadsheet can store a formula without evaluating it. The test record should state which behaviours were observed and which remain assumptions.[^export]

## Limitations and follow-up

This fixture is synthetic and does not test all languages, scripts, publishing requirements or assistive technologies. It does not establish regulatory compliance, legal review or real customer value. It is intended to expose concrete failures before a document is delivered.

Follow-up work should target an observed gap. If a table cannot fit at a readable size, test a landscape schedule or companion workbook. If a recipient requires a prescribed form, validate against that form rather than changing it to match a house report style. If a source element has no supported export representation, stop that export with its location and retain the source.

## References

- W3C Web Accessibility Initiative. [Tables tutorial](https://www.w3.org/WAI/tutorials/tables/). Accessed September 11, 2026.
- Section508.gov. [Create accessible PDFs](https://www.section508.gov/create/pdfs/). Accessed September 11, 2026.

[^method]: Method note: all fixture counts in this report are illustrative and were chosen to exercise the renderer.
[^export]: Export note: generating a file and validating it in a recipient application are separate observations.
