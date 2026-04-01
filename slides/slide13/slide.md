---
theme: default
title: Column layouts
---

Use **`@@@columns`** blocks so each column is **full markdown** (images, tables, code, lists). Separate cells with **`@@cell`** on its own line; close with **`@@@`**.

## Two columns with markdown

@@@columns:2
@@cell
### Left column

![Tiny photo](https://picsum.photos/seed/col-a/280/160)

- Bullet one
- Bullet two
@@cell
### Right column

| Key | Value |
| --- | ----- |
| A   | 1     |
| B   | 2     |

```ts
const ok = true;
```

@@@
