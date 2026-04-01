# Markdown Slides

A Vite + React presentation app for markdown and HTML slides with theme packs, charts (Recharts), Mermaid diagrams, multi-column layouts, and optional per-slide working areas.

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
| `bun run deck:create --id deck01 --title "Deck 01" [--subtitle "…"]` | Scaffold a new deck |
| `bun run deck:export --id deck01 --out ./deck01.zip` | Export one deck to zip |
| `bun run deck:import --zip ./deck01.zip` | Import deck zip into `decks/` |

Restart the dev server after adding new files under `decks/` or `themes/` so Vite's glob imports pick them up.

---

## Folder structure

```text
markdown-slider/
├── decks/
│   ├── sample-deck/           # Tracked sample deck
│   │   ├── metadata.md        # Deck metadata frontmatter
│   │   └── slide01/
│   │       ├── slide.md
│   │       ├── slide.html
│   │       └── working-area/
│   │           ├── slide.md
│   │           ├── slide.html
│   │           ├── style.css
│   │           └── script.js
│   └── <your-local-decks>/    # Usually gitignored
├── themes/                    # Theme presets (`*.yaml`); `_*.yaml` ignored
├── src/
└── scripts/deck-cli.mjs
```

### Deck and slide discovery

- App starts on a deck picker screen.
- A deck is discovered from `decks/<deckId>/` with at least one `slideNN/slide.md` or `slide.html`.
- Deck metadata comes from `decks/<deckId>/metadata.md`.
- Slide folders are naturally sorted (`slide01`, `slide02`, ..., `slide10`).
- If both `slide.md` and `slide.html` exist in one slide folder, `slide.md` wins.

### Deck metadata (`metadata.md`)

```yaml
---
title: Team Update
subtitle: DECK MODE
author: Jane Doe
date: 2026-03-31
defaultTheme: default
description: Weekly roadmap sync
tags:
  - weekly
  - roadmap
---
```

`subtitle` is the small line under the deck title in the app header (deck mode). `defaultTheme` is applied when a slide omits `theme` in its frontmatter.

While viewing a deck, use **Edit deck metadata** (pencil in the header) to change title, subtitle, and related fields; those edits are stored in the browser. Use **Copy YAML** there to paste into `metadata.md` if you want the repo file to match.

### Working area

- If `decks/<deckId>/slideNN/working-area/slide.md` or `slide.html` exists, that slide has a working area.
- Use the header control or **F** to flip between main slide and working area.
- For HTML working areas, optional `style.css` and `script.js` are inlined at build time.

---

## Themes

Slide appearance comes from YAML files in `themes/`. **default** uses Libre Baskerville + Libre Franklin with the navy/slate/coral palette. **watermelon-sorbet** uses Lora + Manrope with the Watermelon Sorbet palette. **rustic-charm** uses Montserrat + Nunito with the Rustic Charm palette. **monochrome-red** uses Oswald + Montserrat with the Monochrome Red palette. **cherry-blossom** uses Lusitana + Raleway with the Cherry Blossom palette (midnight, cherry red, slate, pale mint, off-white). **fiery-ocean** uses Ovo + Mulish with the Fiery Ocean palette (dark red, bright red, cream, indigo, sky blue). Reference in frontmatter:

```yaml
theme: default
# or
theme: watermelon-sorbet
# or
theme: rustic-charm
# or
theme: monochrome-red
# or
theme: cherry-blossom
# or
theme: fiery-ocean
```

If `theme` is missing on a slide, deck `defaultTheme` is used, then fallback `default`.

### Slide layouts (`layout:` in frontmatter)

| `layout` | What you see |
|----------|----------------|
| `content` | *(default)* Header with `title` and optional `subtitle`; markdown body scrolls below. |
| `cover` | **Only** frontmatter `title` and `subtitle` (and optional `backgroundImage:` for full-bleed). Text after the closing `---` is **not rendered**—put all visible copy in YAML. |
| `infographic` | Strong header with `title` only (`subtitle` hidden); body for compact KPIs or one diagram. |
| `image` | Centered figure from a markdown image in the body; optional `caption`, `imageWidth`, `imageHeight` in frontmatter. |
| `quote` | Quote body (e.g. blockquote); `subtitle` works well as attribution. |

Examples: `decks/sample-deck/slide05` (content), `slide07` / `slide51` (cover), `slide06` (infographic), `slide08` (image), `slide59` (quote).

---

## Import / Export

- Create a deck with one starter slide:

  ```bash
  bun run deck:create --id deck01 --title "Deck 01" --subtitle "Optional tagline" --author "You" --default-theme default
  ```

- Export a deck:

  ```bash
  bun run deck:export --id deck01 --out ./deck01.zip
  ```

- Import a deck:

  ```bash
  bun run deck:import --zip ./deck01.zip
  ```

Deck id collisions are auto-resolved by suffixing (`-2`, `-3`, ...).

---

## UI overview

- **Deck picker**: choose a deck from the list and **Open deck**, or fill **Create new deck** and copy the generated `deck:create` command. Primary actions use the app design tokens (`src/styles/theme.css`); light/dark mode toggles both the chrome and the document `dark` class so colors stay consistent.
- **Navigation**: side arrows, footer dots, and keyboard shortcuts (see footer hint).
- **Theme toggle (T)**: sun/moon switches light vs dark mode for the shell.
- **Flip (F)**: switches to working area when available.
- **Add Slide** / **Add Working Area**: footer buttons (session-only); they use the shared shadcn `Button` styling with the same outline treatment as other chrome controls.
- **Per-slide source (E)**: code button edits raw `slide.md` / `slide.html` in-memory.
- **Presentation (P)**: fullscreen slide view; **Esc** exits.
- **Go to slide (G)**: jump by slide number.
- **Edit deck metadata**: pencil in the header opens the dialog (browser-stored overrides; see **Deck metadata** above).

---

## See also

- [`themes/README.md`](themes/README.md) for theme authoring
- `decks/sample-deck/` for the tracked example deck
