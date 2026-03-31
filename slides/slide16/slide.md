---
theme: default
title: Text alignment
---

## Whole slide (frontmatter)

Use `align: left`, `align: center`, or `align: right` in YAML **frontmatter** (same level as `theme:`) to align body text and headings. The deck title uses `title:` / `subtitle:` (see the header above).

This slide omits `align`, so it follows the theme default (`align: left` on the default theme).

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
