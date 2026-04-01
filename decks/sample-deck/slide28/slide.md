---
title: Mermaid — state diagram
---

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> Paused : pause
  Paused --> Running : resume
  Running --> Idle : stop
  Paused --> Idle : stop
```
