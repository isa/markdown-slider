---
theme: ocean
title: Bar chart (Recharts)
subtitle: Grouped (v1–v3)
barChart:
  - cat: A
    v1: 120
    v2: 98
    v3: 46
  - cat: B
    v1: 86
    v2: 110
    v3: 52
  - cat: C
    v1: 140
    v2: 72
    v3: 61
  - cat: D
    v1: 95
    v2: 105
    v3: 48
  - cat: E
    v1: 72
    v2: 128
    v3: 55
---

Each bar **grows from 0 to its value** with stagger; add as many numeric columns as you need (here **v1–v3**). **`barChartStacked: true`** in frontmatter switches to a stacked chart (next slide).

<div class="slide-embed-bar-chart"></div>

Tighter **barGap** / **barCategoryGap** when there are several series in a group, or a single series so categories sit closer.
