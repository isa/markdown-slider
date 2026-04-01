---
title: Mermaid — git graph
---

```mermaid
gitGraph
    commit id: "init"
    commit id: "feat-a"
    branch dev
    checkout dev
    commit id: "wip"
    checkout main
    merge dev id: "merge dev"
    commit id: "release"
```
