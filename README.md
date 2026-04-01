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
| `bun run deck:create --id deck01 --title "Deck 01"` | Scaffold a new deck |
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
author: Jane Doe
date: 2026-03-31
defaultTheme: default
description: Weekly roadmap sync
tags:
  - weekly
  - roadmap
---
```

`defaultTheme` is applied when a slide omits `theme` in its frontmatter.

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

---

## Import / Export

- Create a deck with one starter slide:

  ```bash
  bun run deck:create --id deck01 --title "Deck 01" --author "You" --default-theme default
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

- **Deck picker first screen**: open existing deck or generate a creation command.
- **Navigation**: side arrows, footer dots, and keyboard shortcuts.
- **Theme toggle**: sun/moon switches light vs dark mode.
- **Flip**: switches to working area when available.
- **Add Slide**: inserts a new slide immediately after current slide (session-only).
- **Add Working Area**: adds a working area to the current slide (session-only).
- **Per-slide source**: code button edits raw `slide.md` / `slide.html` in-memory.

---

## See also

- [`themes/README.md`](themes/README.md) for theme authoring
- `decks/sample-deck/` for the tracked example deck
