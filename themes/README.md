# Slide themes

Colors and typography are **separate** YAML presets so you can mix any palette with any font pack without multiplying files.

- **Palettes** — `themes/palettes/*.yaml` — `--slide-text`, `--slide-accent`, shadows, code/table surfaces, etc.
- **Fonts** — `themes/fonts/*.yaml` — `--slide-font-heading`, `--slide-font-body`, sizes, line height.

Files named `_*.yaml` are ignored.

## Deck defaults (`metadata.md`)

Prefer explicit axes:

```yaml
defaultPalette: default
defaultFont: libre-baskerville-franklin
```

**Legacy:** `defaultTheme: default` (and the other bundle ids below) still resolves to the same palette + font pairs via `src/app/legacyThemeBundles.ts`.

## Slide frontmatter

**Combine** palette + font:

```yaml
palette: monochrome-red
font: lora-manrope
```

**Legacy shorthand** — one id selects a **named bundle** (palette + font):

```yaml
theme: default
```

```yaml
theme: watermelon-sorbet
```

```yaml
theme: rustic-charm
```

```yaml
theme: monochrome-red
```

```yaml
theme: cherry-blossom
```

```yaml
theme: fiery-ocean
```

If `palette` / `font` are omitted on a slide, deck defaults apply; if those are missing, bundle **`default`** is used.

Load new fonts in `index.html` when you add a font pack that needs them.

The app **light/dark toggle** selects which token set is active: nested maps **`dark:`** and **`light:`**, each with a **`css:`** map of `--slide-*` variables.

## Palette file format

| Field | Required | Description |
|--------|-----------|-------------|
| `id` | Recommended | Matches `palette:` in slides (e.g. `default`, `monochrome-red`). |
| `name` | Optional | Human-readable label. |
| `description` | Optional | Short summary. |
| `align` | Optional | Default whole-slide alignment: `left`, `center`, or `right`. |
| `rootClassName` | Optional | Extra class on `.slide-root`. |
| `dark` | **Required** (or legacy `css`) | YAML object with **`css:`** — non-font `--slide-*` variables for app dark mode. |
| `light` | **Recommended** | Same shape for app light mode. |

## Font file format

Same structure, but **`css:`** should only set typography-related variables (`--slide-font-*`, `--slide-line-height-body`, `--slide-heading-weight-*` if used).

Per-slide overrides under **`slide:`** in frontmatter merge on top (see `src/app/slideThemes.ts` `OVERRIDE_KEYS`). Staggered entrance without a separate theme: **`slide: { entrance: stagger }`**.

**Slide card width** — default max width is `56rem` on `.slide-root`. Override with **`width`** or **`maxWidth`** (top-level or under `slide:`), using any CSS length (e.g. `90%`, `72rem`, `min(100%, 48rem)`):

```yaml
width: 90%
```

```yaml
slide:
  maxWidth: min(100%, 52rem)
```

## CSS variables

Typography: `--slide-font-heading`, `--slide-font-body`, `--slide-font-mono`, sizes, line height.

Colors: `--slide-text`, `--slide-text-muted`, `--slide-heading-*-color`, `--slide-accent`, `--slide-bg`, `--slide-bullet-color`, code/table/blockquote tokens, etc.

Restart the dev server after adding or editing files under `themes/palettes/` or `themes/fonts/` so Vite picks up the globs.
