# Markdown Slide Deck with Terminal

This is a code bundle for Markdown Slide Deck with Terminal.

## Running the code

Install [Bun](https://bun.sh), then from this directory run `bun install` to install dependencies.

Run `bun run dev` to start the development server.

Run `bun run build` for a production build.

## Slide authoring (quick reference)

- **Alignment** — In frontmatter, `align: left` | `center` | `right`, or wrap a block in `<div class="slide-align--center">…</div>` (also `slide-align--left` / `slide-align--right`). See the “Text alignment” slide in the deck.
- **Inline highlighted code** — Use HTML: `<code class="language-ts">const x = 1</code>` (language class required). Fenced blocks use normal ` ```ts ` fences.
- **Columns with full markdown** — Use `@@@columns:N` … `@@cell` … `@@@` (see `slides/slide13/slide.md`).
- **HTML slide** — Use `slide.html` instead of `slide.md` in a slide folder for a full document in an iframe.
