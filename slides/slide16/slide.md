---
theme: default
---

# Text alignment

## Whole slide (frontmatter)

Use `align: left`, `align: center`, or `align: right` in YAML **frontmatter** (same level as `theme:`) to align body text and headings.

This slide uses the default (body left, H1/H2 centered by theme).

---

## Block alignment (HTML)

Wrap content in a sanitized `div` with `slide-align--left`, `slide-align--center`, or `slide-align--right` for headings, paragraphs, images, or tables inside that block.

<div class="slide-align--center">

### Centered block

![Small sample](https://picsum.photos/seed/align-demo/400/220)

| Col A | Col B |
| ----- | ----- |
| 1     | 2     |

</div>

<div class="slide-align--right">

Right-aligned **text** and `inline code`.

</div>

Inline highlighted code (HTML): <code class="language-ts">type X = { ok: true }</code>
