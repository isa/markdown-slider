# Slide themes

Each file `themes/<id>.yaml` defines one theme. In slide frontmatter, reference it with:

```yaml
theme: <id>
```

Example: `themes/ocean.yaml` → `theme: ocean`.

Slide **colors and surfaces** follow the **app light/dark toggle** (sun/moon in the header):

- **`dark:`** — nested `css:` map of `--slide-*` variables when the app is in **dark mode**.
- **`light:`** — nested `css:` map for **light mode**.

If `light:` is omitted, the loader uses a built-in generic light fallback. Prefer defining both `dark` and `light` explicitly.

**Legacy:** a single top-level `css:` map (no `dark:` / `light:` wrapper) is treated as the **dark** variant only; light still uses the fallback until you add `light:`.

## File format

| Field | Required | Description |
|--------|-----------|-------------|
| `id` | Recommended | Must match the theme key used in `theme:`. If omitted, the file name without `.yaml` is used. |
| `name` | Optional | Human-readable label. |
| `description` | Optional | Short summary. |
| `align` | Optional | Default whole-slide alignment when the slide does not set `align:`: `left`, `center`, or `right`. |
| `rootClassName` | Optional | Extra class on `.slide-root` (e.g. `slide-root--stagger` for staggered body animations). |
| `dark` | **Required** (or legacy `css`) | YAML object with a **`css:`** key whose value is a map of `--slide-*` CSS custom properties. |
| `light` | **Recommended** | Same shape as `dark`: **`css:`** map for light app mode. |

Files whose names start with `_` are ignored by the loader (e.g. `_template.yaml`).

### YAML shape (not separate `.css` files)

Variables live under **`dark.css`** and **`light.css`** in the sense of YAML keys — not standalone `dark.css` / `light.css` files on disk:

```yaml
dark:
  css:
    --slide-text: "#e4e4e7"
    --slide-accent: "#60a5fa"
    # …

light:
  css:
    --slide-text: "#27272a"
    --slide-accent: "#2563eb"
    # …
```

Only keys starting with `--` are read; values may be strings or numbers (coerced to strings).

## `css` variables (tokens)

Use the same **`--slide-*` keys** in both `dark.css` and `light.css` maps; only values change.

**Typography:** `--slide-font-heading`, `--slide-font-body`, `--slide-font-mono`, `--slide-font-size-h1` / `h2` / `h3`, `--slide-font-size-body`, `--slide-line-height-body`.

**Heading colors (set level-specific vars in each variant for a clear hierarchy):**

| Variable | Used for |
|----------|-----------|
| `--slide-heading-color` | Legacy fallback if a level-specific var is missing |
| `--slide-heading-h1-color` | `#` / H1 |
| `--slide-heading-h2-color` | `##` / H2 |
| `--slide-heading-h3-color` | `###` / H3 |

Optional weights (numeric strings, e.g. `"700"`): **`--slide-heading-weight-1`**, **`--slide-heading-weight-2`**, **`--slide-heading-weight-3`**.

**Other common tokens:** `--slide-text`, `--slide-text-muted`, `--slide-accent`, `--slide-bg`, `--slide-bullet-color`, `--slide-list-spacing`, `--slide-image-radius`, `--slide-image-shadow`, `--slide-image-max-width`, `--slide-code-bg`, `--slide-code-text`, `--slide-blockquote-border`, `--slide-table-border`, `--slide-table-header-bg`, `--slide-column-gap`.

**Motion:** `--slide-entrance` — use `none` (default) or `stagger`. When set to **`stagger`** (in the active variant’s `css` map), the slide root uses the same stagger animation as theme `rootClassName: slide-root--stagger`. Per-slide frontmatter can also force stagger with **`slide: { entrance: stagger }`**.

Per-slide overrides in YAML under **`slide:`** (camelCase keys) merge on top of the active variant. Supported keys map to the variables above, for example: `fontHeading`, `fontBody`, `fontMono`, `fontSizeH1`, `fontSizeH2`, `fontSizeH3`, `fontSizeBody`, `lineHeightBody`, `text`, `textMuted`, `headingColor`, `headingH1Color`, `headingH2Color`, `headingH3Color`, `headingWeight1`, `headingWeight2`, `headingWeight3`, `accent`, `bg`, `bulletColor`, `listSpacing`, `imageRadius`, `imageShadow`, `imageMaxWidth`, `codeBg`, `codeText`, `blockquoteBorder`, `tableBorder`, `tableHeaderBg`, `columnGap`, and **`align`**.

## New theme checklist

1. Copy `themes/_template.yaml` to `themes/<your-id>.yaml` (do not use a leading `_` in the filename).
2. Set `id` and fill both **`dark:` → `css:`** and **`light:` → `css:`** with full `--slide-*` token sets (copy from `default.yaml` or `_template.yaml` and adjust).
3. Use `theme: <your-id>` in slides.

Restart the dev server after adding a new file so Vite picks up the glob.

If `themes/default.yaml` is missing, the app still injects an embedded **default** preset until you add that file.
