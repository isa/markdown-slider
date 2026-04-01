---
title: Typography — lists & code
subtitle: Bullets, numbering, nesting, fenced blocks
---

## Unordered

- First item
- Second item with **bold** inside
  - Nested bullet
  - Another nested
- Third item

## Ordered

1. First step
2. Second step
3. Third step

### Fenced code block

```ts
type Slide = {
  id: string;
  title?: string;
};

export function parseSlide(raw: string): Slide {
  return { id: "demo" };
}
```

### Another language

```yaml
theme: default
layout: content
title: Hello
```
