---
title: Typography — alignment & accents
subtitle: Whole-slide align, per-block align, slide-accent, theme overrides
align: center
theme: default
slide:
  accent: "#f472b6"
  headingH2Color: "#e2e8f0"
---

Whole-slide alignment is **center** via frontmatter `align: center`. This slide also overrides `slide.accent` and `slide.headingH2Color` on top of the **default** theme.

<div class="slide-align--left">

## Left block in a centered slide

Per-block alignment uses a sanitized `div` with `class="slide-align--left"` (or `align--left`).

</div>

<div class="slide-align--right">

Right-aligned paragraph with <span class="slide-accent">accent-colored span</span> using `.slide-accent`.

</div>

> Blockquote: theme tokens drive border and text color.
