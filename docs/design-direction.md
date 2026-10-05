# Rōvn document art direction — 3 October 2026

The founder rejected both the repetitive amber/paper template and the subsequent
sterile office-style revision. The direction is a recognizable, beautifully
composed Rōvn system: the original brand mark, expressive professional typography,
pure-white reading surfaces, and deliberate amber. This replaces the earlier
instruction to reduce the brand to a tiny amber dash.

## The job of this skill

Choose the strongest professional structure and visual approach for the reader,
occasion and action. Then render, inspect and refine that specific document.
A family classifier is a fallback; it does not research examples or exercise taste.
A successful export does not establish that the selected design is appropriate.

For substantial new work, keep a short design brief beside the source: reader,
occasion, action, format, density, page budget, two relevant reference approaches,
the selected composition and why it fits. Reuse a reviewed brief for revisions.
Research unfamiliar occasions using primary examples and recipient requirements.
Read references in the background; do not repeatedly open the same reference files
or create another gallery when the user requested a finished document.

Choose the reading sequence from the content. Do not manufacture the same cover,
three-card overview, contents page and section outline for every request. Do not
invent company claims, statistics, quotations, approvals or decorative charts.

## The identity

- Use the actual Rōvn lockup in `assets/brand/rovn-lockup.svg`, never a typed
  approximation. Its paths are extracted unchanged from Jerry's original Paper
  cover. The symbol can carry amber while the wordmark remains ink. Keep clear
  space and correct proportions. Legal correspondence can use the ink-only mark.
- Use **Crimson Pro** for expressive display typography and editorial reading,
  **Inter** for clear body text, procedures and data, and **Fragment Mono** for
  literal code and quiet folios. Font choice follows the role; font novelty is
  not a quality criterion. Do not set every heading in heavy sans-serif.
- Register the actual variable weight ranges: Crimson Pro 200–900, Inter 100–900.
  Embed their real italic faces. Set `font-synthesis:none` so faux bold/italics
  cannot replace the intended typography. The professional PDF embeds fonts;
  native Office typography requires the corresponding fonts on the receiving system.
- Use scale, proportion and rhythm: roughly 34–48pt display, 18–26pt editorial
  section headings, 10–11pt body, and restrained metadata. Short memo/letter/legal
  work needs a quieter scale. Keep line lengths readable and related items aligned.
  Adjust composition and page flow before considering smaller type.
- Pure white `#FFFFFF` is the page and reading canvas. No paper texture, cream,
  ivory, beige, off-white panels, warm gradients or parchment effects.
- Ink `#15181E` carries the information. Neutral gray supports metadata and rules.
  Amber belongs visibly in the mark, section numerals, selected labels and useful
  emphasis. Use dark amber `#9C590A` for small text on white, `#B66A09` for the mark,
  and rich amber `#EAA544` against ink or as a bounded authored emphasis panel.
  Keep amber subordinate to the content; never wash every page or table in it.
- An occasional ink panel with white copy and an amber title can create a clear
  focal point. A selected amber callout is supported when it earns its place.
  Do not automatically insert either into every document. Avoid decorative boxes,
  excessive rules and repeated section banners.

## Compose for the occasion

| Occasion | Composition | Reader priority |
| --- | --- | --- |
| Decision memo | Split masthead; decision labels beside continuous body | Decision, evidence, consequence, owner |
| Board paper | Restrained title; stable item rail | Recommendation, options, risk, authority |
| Client proposal | Expressive opening; amber section index; open commercial tables | Scope, exclusions, responsibilities, economics |
| Report | Editorial headline; inset reading column; clear evidence hierarchy | Question, method, findings, limits |
| Business plan | Larger opening; numbered chapter hierarchy | Choices, assumptions, execution |
| Pricing sheet | Compact heading; aligned figures; quiet comparison grid | Scope, units, price |
| Case study | Compact editorial story; visible evidence labels | Context, action, observed result |
| SOP | Sans-serif action headings; repeated step gutter | Next action, owner, exception |
| Letter | Discreet letterhead; familiar correspondence structure | Recipient, subject, message |
| Agreement | Ink-only mark; conventional type and exact clauses | Supplied terms and execution structure |

These are starting compositions, not ten prescribed outlines. Use supplied leads,
key values, tables, cards, images or callouts only when they help the reader. Image
rights and evidence status remain separate. Extend the appropriate adapter when
its layout cannot express the justified direction; do not silently substitute the
old report template or a generic unbranded export.

## Jerry's design source

[Jerry's public repository](https://github.com/jkou-cmd/use-rovn-design-system)
was fetched at revision `f00d0183e6353d5953c2a4a7dca700c68da1a5b1` on 3 October 2026.
The original [Paper capture](../design/paper/README.md) provides 17 reference frames.
The cover (`OC9-0`), section typography (`TTI-0`), components (`UBS-0`) and
continuation grid (`U0I-0`) informed this revision. The original mark, typographic
contrast and asymmetric navigation are retained; the original paper-colored
canvas and automatic amber image headers are not current defaults.

Consult the [resource catalog](research/research-and-resource-catalog.md) for
family-specific conventions and the [taxonomy](research/document-taxonomy.json)
for specialist routes. Reference coverage is broader than implemented adapters.

## Review the actual result

Inspect every exported page at reading size. Check headline wraps, hierarchy,
small type, line length, page rhythm, source retention, contrast, table continuation,
stranded headings and nearly empty spill pages. Compare relevant families side by
side when changing the system: useful structure should differ while the brand
remains recognizable. Show one considered result, not an endless loop of references.

`examples/professional/brand-editorial.json` exercises the actual current renderer,
including the exact logo, display type, cards and authored ink callout. It is a
design specimen, not a company performance claim or a universal template. The
regression gallery supplies content/pagination evidence, not an aesthetic grade.

`report-v1` remains only for explicit historical reproduction and reference tests.
Ordinary inputs, including old prepared JSON, use the professional route. Unsupported
legacy fields require an explicit content-preserving adaptation. Live websites and
apps are not redesigned or deployed by changing this local document system.
