# Document model and component catalog

`schemaVersion: 1` is a content model, independent of the report page size. The renderer accepts `.md`, `.markdown`, `.docx`, and a prepared `.json` document. The skill can choose richer layouts by editing prepared JSON; ordinary users do not need special markup.

## Markdown

Use one `#` heading for the document title, `##` for main sections, `###` for numbered subsections, and `####` or deeper for unnumbered subheadings. Leading prose becomes an Overview section. Lists, emphasis, links, tables, code fences, images, and `[^note]` footnotes are supported. Notion-exported `<aside>` callouts are supported; their decorative emoji are replaced by the supplied component icon. Raw HTML is not executed.

Optional YAML frontmatter: `title`, `subtitle`, `eyebrow`, `summary`, `smallPrint`, `author`, `date`, `version`, `coverImage`, `darkPages` (boolean, default `true`), and `sources`. Put source entries in `sources` as objects with `title`, optional `item`, `url`, `label`, and `description`. Alternatively, an explicit Sources/References/Bibliography/Appendix section is moved to the appendix without inventing bibliography data.

An optional fenced block with language `rovn` contains one JSON component as described below. This supports explicit author control and is not required for normal input.

## Prepared JSON

```json
{
  "schemaVersion": 1,
  "metadata": { "title": "Report title", "author": "Supplied author" },
  "options": { "darkPages": true },
  "sections": [
    {
      "title": "First section",
      "headerImage": "assets/bg2.png",
      "blocks": [
        { "type": "lead", "text": "A supplied section introduction." },
        { "type": "heading", "level": 1, "text": "First subsection" },
        { "type": "paragraph", "text": "The source argument, with **emphasis**." }
      ]
    }
  ],
  "footnotes": {},
  "sources": [],
  "appendix": []
}
```

IDs, section letters and subsection numbers are generated. Keep generated IDs stable when editing a prepared model; new components may omit IDs. Inline `text` is Markdown; `html` is sanitized inline markup and takes precedence if both exist. When editing parsed paragraphs, update `html`, not an unused `text` field. Supported inline elements: emphasis, strong, links, inline code, superscript/subscript, strikethrough, and line breaks. Footnote references are `<span data-note="1">1</span>` and definitions are inline HTML keyed by that number in `footnotes`.

## Components

| Type | Fields | Paper template |
| --- | --- | --- |
| `paragraph` | `text` or `html`; optional margin `note` | Full-width body, 12 px Inter / 18 px line height |
| `lead` | `text` or `html` | Section introduction with rule, 20 px light Crimson Pro |
| `heading` | `text`, `level` (1 = numbered subsection, 2+ = subheading) | 24 px subsection or 20 px subheading |
| `list-item` | `text`/`html`, `marker`, `depth` | 24 px marker slot, nested indentation |
| `callout` | `variant` 1–6, `title`, `text`/`html`, optional `icon` and `note` | All six supplied callouts |
| `cards` | `variant`, `items` (two or three objects with `title` and `text`/`html`), optional `note` | Filled/outlined or ruled blocks |
| `table` | `headers`, `rows`, optional `variant` 1/2, `widths`, `note` | Rounded panel or ruled table; repeated header on continuation |
| `code` | Literal `text`, optional `language` and `note` | 10 px Fragment Mono code panel |
| `image` | `src`, `alt`, `caption`, optional `height`, `decorative`, `crop` | Rounded image and caption within main column |
| `image-band` | `src`, `alt`, `caption`, optional `amberSrc`, `decorative`, `crop` | Bleeding image band with amber image beside it |
| `image-column` | `blocks`, one or two `images`, optional `note` | 329 px text + 64 px gap + 259 px image column |
| `rule` | None | Existing full-width separator |

Callout variants: 1 = compact ruled; 2 = neutral panel; 3 = neutral panel with icon; 4 = amber panel with icon; 5 = editorial ruled; 6 = ruled with icon. Callout icons come from the pinned local [Lucide Static](https://lucide.dev/guide/static) package. Use any kebab-case name, such as `shield-check`, `calendar-clock`, `search`, `graduation-cap`, or `triangle-alert`. Run `node scripts/list-icons.mjs SEARCH` to find valid names. Unknown names fail visibly.

- With no `icon` field, variants 3, 4, and 6 automatically choose a contextual icon. Variants 1, 2, and 5 remain iconless.
- `icon: "auto"` chooses from the callout title/body using deterministic keyword rules; the invoking agent should use an explicit name when its semantic judgment is more appropriate.
- An explicit icon on an iconless variant selects the nearest designed icon-bearing variant: 1 → 6, 2 → 3, 5 → 6. Choose the variant intentionally when editing.
- `icon: "none"` hides the icon while preserving its slot on icon-bearing variants. Use an iconless variant to omit the slot.
- SVGs are embedded locally at the original 24 px size and 2 px stroke, with the exact light/dark palette. Cards retain their original Paper icons.

Example component: `{"type":"callout","variant":4,"icon":"shield-check","title":"Privacy","text":"Keep the supplied documents secure."}`.

Cards variants: `numbered`, `icons`, `ruled-numbered`, `ruled-icons`. Two or three cards are supported; larger groups should be split into multiple rows. Cards use the original neutral/amber/green/outline sequence and icons.

Table cells and headings contain inline HTML. `widths` is an array of positive relative column weights. Three-column tables default to the source template's proportions; other column counts use equal shares. Wide or semantically complex tables may need editorial restructuring into multiple tables. No data may be discarded.

Image paths can be relative to the input file or begin with `assets/` for bundled images. Cover/header imagery defaults to `assets/bg1.png`–`assets/bg4.png`. Agents may also search the web for imagery matching the warm, atmospheric, botanical/natural mood. Cover and section-header images must be visually reviewed as amber; body imagery may use complementary brand tones. ToC and appendix artwork remains fixed.

For a reviewed custom cover, section header, or image-band amber panel, use an object instead of a bundled path:

```json
{"src":"images/amber-landscape.jpg","mood":"amber","sourceUrl":"https://example.com/original-image-page"}
```

This object is accepted in `metadata.coverImage`, `section.headerImage`, and `block.amberSrc`. `mood: "amber"` records the agent's visual review; it is not automated color classification. The renderer embeds the local image and preserves the object so prepared JSON remains portable across subsequent renders. Existing bundled paths remain supported. Unreviewed custom strings are rejected. Input charts/screenshots use contain by default; decorative images use cover. Web images must be downloaded locally before rendering. Retain source/creator/license details in an imagery record beside the prepared document and include any required attribution. Preparation embeds input images in the JSON; the output HTML embeds all fonts and images.

## Dark pages

Markdown frontmatter can set `darkPages: false` or `darkPages: true`; prepared JSON uses `options.darkPages`. The default is true. `--dark-pages on` or `--dark-pages off` overrides the input, including during `--prepare`. With off, every body page uses the light template; the cover/ToC/appendix compositions stay fixed. With on, approximately 20–25% of body pages use the supplied dark variants. The choice affects color, not pagination. The QA report records `darkPagesEnabled` and `darkBodyIndices`.

## Pagination and errors

The engine measures after fonts load, keeps headings with following content, splits rich text at rendered lines, repeats table headers, and retains component styling on continuations. Content fields are compared before and after pagination to detect loss or duplication. PDF dimensions are 612 × 792 points (US Letter), corresponding to 816 × 1056 CSS pixels.

Cover text has a fixed composition. A title or supplied summary too large for the cover produces an error rather than smaller typography. Ask for a shorter display title or move supplied material into the body with permission. Extremely tall unsplittable images, unsupported embedded objects/equations, and footnotes that cannot fit their page produce errors requiring editorial handling; they are not silently omitted.

The renderer preserves source text. Light editing and selecting richer templates are the invoking agent's responsibility. CLI-only use formats the source structure and honors explicit components; it does not call an LLM.
