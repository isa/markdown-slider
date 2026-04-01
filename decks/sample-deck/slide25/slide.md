---
title: Mermaid — flowchart (ELK)
subtitle: Default flowchart renderer uses ELK for orthogonal edges
---

```mermaid
flowchart TB
  subgraph ingest["Ingest"]
    A[Events] --> B[Validate]
  end
  B --> C{OK?}
  C -->|yes| D[Store]
  C -->|no| E[Dead letter]
  D --> F[Notify]
```
