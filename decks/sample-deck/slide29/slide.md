---
title: Mermaid — ER diagram
---

```mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "ordered in"
  CUSTOMER {
    uuid id PK
    string email
    string name
  }
  ORDER {
    uuid id PK
    date placed_at
  }
```
