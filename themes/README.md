# Slide themes

Each file `themes/<id>.yaml` defines one theme. In slide frontmatter, reference it with:

```yaml
theme: <id>
```

Example: `themes/ocean.yaml` → `theme: ocean`.

Slide **colors and surfaces** follow the **app light/dark toggle** (sun/moon in the header):

- **`dark:`** — CSS tokens when the app is in **dark mode** (dark slide card on dark chrome).
- **`light:`** — CSS tokens when the app is in **light mode** (readable text on light slide card).

Both blocks are required for a complete theme. If `light:` is omitted, a generic light fallback is used (prefer defining both explicitly).

Legacy: a single top-level `css:` map is treated as the **dark** variant only; **light** still falls back until you add `light:`.

## File format

| Field | Required | Description |
|--------|-----------|-------------|
| `id` | Recommended | Must match the theme key used in `theme:`. If omitted, the file name without `.yaml` is used. |
| `name` | Optional | Human-readable label. |
| `description` | Optional | Short summary. |
| `align` | Optional | Default whole-slide alignment when the slide does not set `align:`: `left`, `center`, or `right`. |
| `rootClassName` | Optional | Extra class on `.slide-root` (e.g. `slide-root--stagger`). |
| `dark` | **Required** (or legacy `css`) | Object with `css:` map of `--slide-*` variables for dark app mode. |
| `light` | **Recommended** | Object with `css:` map for light app mode. |

Files whose names start with `_` are ignored by the loader.

## `css` variables (tokens)

Use the same keys in **both** `dark.css` and `light.css`; only values change.

**Typography:** `--slide-font-size-h1` / `h2` / `h3` set heading sizes.

**Heading colors (set all three in each variant for a clear hierarchy):**

| Variable | Used for |
|----------|-----------|
| `--slide-heading-color` | Legacy fallback; still used if a level-specific var is missing |
| `--slide-heading-h1-color` | `#` / H1 |
| `--slide-heading-h2-color` | `##` / H2 |
| `--slide-heading-h3-color` | `###` / H3 |

Optional weights (numeric strings, e.g. `"700"`): **`--slide-heading-weight-1`**, **`--slide-heading-weight-2`**, **`--slide-heading-weight-3`**.

Per-slide overrides in YAML under `slide:` (camelCase keys like `accent`, `fontSizeBody`, `headingH1Color`, `headingWeight1`) still merge on top of the active variant.

## New theme checklist

1. Copy `themes/_template.yaml` to `themes/<your-id>.yaml`.
2. Set `id` and fill **`dark.css`** and **`light.css`** with full token sets.
3. Use `theme: <your-id>` in slides.

Restart the dev server after adding a new file so Vite picks up the glob.
