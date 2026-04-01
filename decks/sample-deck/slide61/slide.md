---
title: Corner watermark
subtitle: Slide-relative image + optional invert
cornerImage: abstract.jpg
cornerPosition: bottom-right
cornerScale: 8
cornerAppearance: invert
cornerGradient: outward
cornerOpacity: 0.9
cornerGradientRadius: 33rem
---

`cornerImage: abstract.jpg` loads `decks/sample-deck/slide61/abstract.jpg` (bundled at build time; in dev, `/__deck/asset/…` until the dev server rescans). This sample uses **`cornerAppearance: invert`** on a 1×1 JPG scaled up. Combine filters with commas, e.g. `cornerAppearance: invert, grayscale` or a YAML list `[invert, grayscale]`.
