---
theme: default
title: Line chart (Recharts)
subtitle: Up to 5 series
lineChartArea: true
lineChart:
  - q: Q1
    alpha: 42
    beta: 28
    gamma: 33
    delta: 22
    epsilon: 18
  - q: Q2
    alpha: 55
    beta: 34
    gamma: 38
    delta: 26
    epsilon: 21
  - q: Q3
    alpha: 48
    beta: 41
    gamma: 36
    delta: 30
    epsilon: 19
  - q: Q4
    alpha: 63
    beta: 52
    gamma: 44
    delta: 35
    epsilon: 24
---

First column = X axis; up to **five** numeric series. With **`lineChartArea: true`** or **`area: true`** (the default), each series is drawn as a line with the region underneath filled at **10% opacity of that line’s color**. Set **`area: false`** for strokes only, no fill.

<div class="slide-embed-line-chart"></div>

Charts inherit theme CSS variables for light/dark and `theme:` in frontmatter.
