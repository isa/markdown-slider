---
title: Mermaid — sequence
---

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant API as API
  participant DB as Database
  U->>+API: POST /items
  API->>+DB: INSERT
  DB-->>-API: ok
  API-->>-U: 201 Created
```
