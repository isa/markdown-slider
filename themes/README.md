# Slide themes

YAML presets live in `themes/*.yaml`. Examples:

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

If `theme` is missing, the deck’s `defaultTheme` applies (usually `default`).

**Watermelon Sorbet** (`watermelon-sorbet.yaml`) uses **Lora** + **Manrope** and the palette Juicy Pink `#EF476F`, Zesty Yellow `#FFD166`, Cool Mint `#06D6A0`, Vibrant Blue `#118AB2`, Deep Navy `#073B4C`.

**Rustic Charm** (`rustic-charm.yaml`) uses **Montserrat** + **Nunito** and cream `#FFFCF2`, taupe `#CCC5B9`, charcoal `#403D39`, near-black `#252422`, rust `#EB5E28`.

**Monochrome Red** (`monochrome-red.yaml`) uses **Oswald** + **Montserrat** and charcoal `#2B2D42`, muted blue-gray `#8D99AE`, pale `#EDF2F4`, bright red `#EF233C`, crimson `#D80032`.

**Cherry Blossom** (`cherry-blossom.yaml`) uses **Lusitana** + **Raleway** and midnight `#0C120C`, cherry red `#C20114`, slate `#6D7275`, pale mint `#C7D6D5`, off-white `#ECEBF3`.

**Fiery Ocean** (`fiery-ocean.yaml`) uses **Ovo** + **Mulish** and dark red `#780000`, bright red `#C1121F`, cream `#FDF0D5`, indigo `#003049`, sky blue `#669BBC`.

Load new fonts in `index.html` when you add a theme that needs them.

The app **light/dark toggle** selects which token set is active: nested maps **`dark:`** and **`light:`**, each with a **`css:`** map of `--slide-*` variables.

## File format

| Field | Required | Description |
|--------|-----------|-------------|
| `id` | Recommended | Must match `theme:` in slides (e.g. `default`, `watermelon-sorbet`, `rustic-charm`, `monochrome-red`, `cherry-blossom`, `fiery-ocean`). |
| `name` | Optional | Human-readable label. |
| `description` | Optional | Short summary. |
| `align` | Optional | Default whole-slide alignment: `left`, `center`, or `right`. |
| `rootClassName` | Optional | Extra class on `.slide-root`. |
| `dark` | **Required** (or legacy `css`) | YAML object with **`css:`** — `--slide-*` custom properties for app dark mode. |
| `light` | **Recommended** | Same shape for app light mode. |

Per-slide overrides under **`slide:`** in frontmatter merge on top (see `src/app/slideThemes.ts` `OVERRIDE_KEYS`). Staggered entrance without a separate theme: **`slide: { entrance: stagger }`**.

## CSS variables

Typography: `--slide-font-heading`, `--slide-font-body`, `--slide-font-mono`, sizes, line height.

Colors: `--slide-text`, `--slide-text-muted`, `--slide-heading-*-color`, `--slide-accent`, `--slide-bg`, `--slide-bullet-color`, code/table/blockquote tokens, etc.

Restart the dev server after adding or editing a theme file so Vite picks up the glob.
