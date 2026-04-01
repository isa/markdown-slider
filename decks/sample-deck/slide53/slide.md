---
title: Chart beside text
subtitle: Columns + YAML chart data on the same slide
lineChart:
  - gen: G1
    score: 12
  - gen: G2
    score: 19
  - gen: G3
    score: 16
  - gen: G4
    score: 22
---

@@@columns:2
@@cell
### Commentary

Use **columns** to place prose next to a chart embed. Frontmatter `lineChart` / `barChart` / `pieChart` applies to the whole slide, including inside column cells.

@@cell
<div class="slide-embed-line-chart"></div>

@@@
