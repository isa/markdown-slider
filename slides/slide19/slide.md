---
theme: default
title: Stacked bars
subtitle: barChartStacked
barChartStacked: true
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
---

Set **`barChartStacked: true`** in YAML so all numeric columns share one **`stackId`** (Recharts stacked layout). Same **`barChart:`** row shape as grouped bars.

<div class="slide-embed-bar-chart"></div>
