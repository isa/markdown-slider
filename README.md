# Markdown Slides

A Vite + React presentation app: markdown slides with YAML frontmatter, optional HTML slides, theme packs, charts (Recharts), Mermaid diagrams, multi-column layouts, and an optional per-slide **working area** (markdown or HTML preview plus a demo terminal).

## Requirements

Install [Bun](https://bun.sh), then from this directory:

```bash
bun install
```

## Scripts

| Command | Description |
|--------|-------------|
| `bun run dev` | Start the Vite dev server |
| `bun run build` | Production build to `dist/` |

Restart the dev server after adding new files under `slides/` or `themes/` so Vite’s glob imports pick them up.

---

## Folder structure

```
markdown-slider/
├── slides/                    # One folder per slide (see below)
│   └── slideN/
│       ├── slide.md           # Preferred slide source (YAML frontmatter + markdown)
│       ├── slide.html         # Alternative: full HTML document in an iframe (if no slide.md)
│       └── working-area/      # Optional; only if this slide has a “working area”
│           ├── slide.md       # or slide.html (md wins if both exist)
│           ├── style.css      # Optional: inlined into the HTML working-area document head
│           └── script.js      # Optional: inlined at end of body
├── themes/                    # Theme presets (`*.yaml`); `_*.yaml` files are ignored
│   ├── _template.yaml         # Copy to create a new theme
│   └── README.md              # Theme file format and token reference
├── src/                       # App source (React, styles, slide loading)
└── README.md                  # This file
```

### How slides are discovered

- Every subdirectory of `slides/` that contains **`slide.md`** or **`slide.html`** becomes one slide.
- Folders are ordered **naturally** (`slide1`, `slide2`, … `slide10`).
- If both `slide.md` and `slide.html` exist in the same folder, **`slide.md` wins**.

### Working area

- If `slides/slideN/working-area/slide.md` or `slide.html` exists, that slide has a **working area**.
- Use the header control or **F** to flip between the main slide and the working area (only when a working area exists).
- For **HTML** working areas, optional `style.css` and `script.js` are inlined into the document at build time.

---

## Themes

Slide appearance comes from YAML presets in `themes/`. Reference a theme in frontmatter:

```yaml
theme: ocean
```

**Built-in theme ids** (from `themes/*.yaml`, excluding `_template`):  
`default`, `ocean`, `paper`, `high-contrast`, `serif-warm`, `stagger`.

- The app’s **sun/moon** control toggles **light vs dark chrome**; each theme supplies tokens for both modes (`dark:` / `light:` in the YAML).
- Invalid or missing `theme:` falls back to **`default`**.
- Authoring new themes, token names, and `dark` / `light` structure are documented in [`themes/README.md`](themes/README.md).

### Frontmatter: `theme` and per-slide overrides

- Top-level **`align`**: `left` | `center` | `right` — whole-slide alignment (also configurable under nested `slide:` — see below).
- Nested **`slide:`** — optional camelCase overrides merged onto the active theme (fonts, colors, spacing, etc.). Keys include:  
  `fontHeading`, `fontBody`, `fontMono`, `fontSizeH1`, `fontSizeH2`, `fontSizeH3`, `fontSizeBody`, `lineHeightBody`, `text`, `textMuted`, `headingColor`, `headingH1Color`, `headingH2Color`, `headingH3Color`, `headingWeight1`, `headingWeight2`, `headingWeight3`, `accent`, `bg`, `bulletColor`, `listSpacing`, `imageRadius`, `imageShadow`, `imageMaxWidth`, `codeBg`, `codeText`, `blockquoteBorder`, `tableBorder`, `tableHeaderBg`, `columnGap`, and **`align`**.
- **`slide.entrance: stagger`** (or theme YAML setting `--slide-entrance: stagger`) applies the staggered entrance animation class.

---

## Frontmatter reference (markdown slides)

YAML between `---` delimiters. The markdown **body** is everything after the frontmatter.

### Layout and titles

| Key | Description |
|-----|-------------|
| `layout` | `content` (default), `cover`, `infographic`, or `image` |
| `title` | Optional deck title shown in the slide chrome (position varies by layout) |
| `subtitle` | Optional subtitle; **not** shown for `infographic` or `image` layouts |
| `theme` | Theme id from `themes/*.yaml` |
| `align` | `left` \| `center` \| `right` — whole-slide alignment |
| `backgroundImage` | URL string; used with **`layout: cover`** for a full-bleed background photo |
| `caption` | With **`layout: image`**, caption below the figure |
| `imageWidth` | With **`layout: image`**, CSS length for max width (e.g. `80%`, `28rem`) |
| `imageHeight` | With **`layout: image`**, CSS length for max height (e.g. `50vh`, `400px`) |

### Charts (data in YAML, placeholders in markdown)

Add arrays under frontmatter and place an **empty** `<div>` in the body where the chart should render:

| Frontmatter | Placeholder in markdown | Purpose |
|-------------|-------------------------|---------|
| `lineChart:` | `<div class="slide-embed-line-chart"></div>` | Line chart: first column = X axis; further columns = numeric series (up to five series) |
| `barChart:` | `<div class="slide-embed-bar-chart"></div>` | Bar chart: same row shape as line charts |
| `pieChart:` | `<div class="slide-embed-pie-chart"></div>` | Rows with category + value (see sample slides for `label` / `value`) |
| `barChartStacked` | — | `true` / `false` — stacked vs grouped bars |
| `pieChartLegendPosition` | — | `left` \| `right` \| `bottom` (aliases: `pieLegendPosition`, `pie_chart_legend_position`) |
| `lineChartArea` or `area` | — | `true` (default) — filled area under lines; `false` — lines only |
| `lineChartEndMarker` or `lineEndMarker` | — | `arrow`, `circle`, `openCircle`, or `none` — marker at last point per series |

### Mermaid

- Use a fenced code block with language **`mermaid`** in the markdown body.
- Optional frontmatter: **`mermaidNodes`**: `filled` (default) or `outline` (stroke-only flowchart boxes).

### HTML slides

- Use `slide.html` instead of `slide.md` for a full HTML document rendered in a **sandboxed iframe** (`allow-scripts`).
- Frontmatter-based themes and markdown features do not apply unless you embed them yourself.

---

## Markdown features

- **GitHub-flavored Markdown** (tables, task lists, strikethrough, etc.) via `remark-gfm`.
- **Raw HTML** in markdown is allowed but **sanitized**; allowed patterns include slide layout classes such as `slide-align--left` / `slide-align--center` / `slide-align--right` on a wrapper `div`.
- **Fenced code blocks** with a language get syntax highlighting; inline code can use `<code class="language-ts">…</code>` for highlight classes.
- **Images** in markdown respect theme variables for radius and shadow.
- **Columns** — multi-column cells with full markdown in each cell:

  ````text
  @@@columns:2
  @@cell
  First column…
  @@cell
  Second column…
  @@@
  ````

  Use `@@@columns:N` where `N` is 1–4. Legacy HTML column markup may still work; prefer `@@@columns` for rich cells.

---

## Keyboard shortcuts

Global shortcuts apply when focus is **not** in a text field (the source editor, inputs, etc.).

| Key | Action |
|-----|--------|
| **→** or **Space** | Next slide |
| **←** | Previous slide |
| **G** | Open “go to slide” (type 1-based index, **Enter** to jump, **Esc** to cancel) |
| **E** | Toggle source editor for the current view (slide or working-area preview) |
| **F** | Flip between main slide and working area (only if that slide has a working area) |
| **T** | Toggle app light / dark mode |

With the **go to slide** dialog open, **Esc** closes it; arrow keys and space do not change slides until the dialog is closed.

In the **source editor**, **Esc** closes the editor (see button tooltips on the slide card).

---

## UI overview

- **Navigation**: side arrows, footer **dot** indicators (click to jump), and keyboard shortcuts above.
- **Theme**: sun/moon in the title bar — switches slide token sets (dark vs light) for all themed markdown slides.
- **Flip** (rotate icon): switches to the working area when defined.
- **Per-slide source**: code button on the slide — edit raw `slide.md` / `slide.html` in the session (changes are in-memory until you copy them out).

---

## See also

- [`themes/README.md`](themes/README.md) — creating and editing theme YAML files
- Example decks under `slides/slide*/slide.md` for alignment, columns, charts, Mermaid, and layouts
