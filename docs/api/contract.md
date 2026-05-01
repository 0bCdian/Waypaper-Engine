# Authoritative API reference (in-repo)

The **full** contract—every route, every example JSON body, **data models**, **enums**, **config sections**, the **Electron bridge** notes, and the **“Local Spec v0”** web-wallpaper addendum—is **maintained in the repository** so it can stay next to the Go handlers:

- **[daemon/API_CONTRACT.md (GitHub)](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md)** — human-oriented, copy-pasteable examples.

**How to use this site and the contract together**

| I need…                                  | Use                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Browsing paths and `operationId` in a UI | [OpenAPI](/api/openapi) (generated from `daemon/docs/openapi.yaml` at the same tag)                                            |
| Narrated examples and the **SSE** tables | The contract, or this site’s [Events & SSE](/api/sse) (the code wins on edge cases)                                            |
| Router truth when something looks wrong  | [`internal/server/routes.go` on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/internal/server/routes.go) |

**NOTE** — The OpenAPI file tracks **path parity**; some bodies still use generic JSON placeholders. The contract and the handler structs are the deep references until the spec is fully expanded.

**NOTE** — I am not mirroring the whole markdown here—the GitHub file is the source, and these **Pages** are the guided tour. If a release forgets to refresh the spec, the tag’s tree on GitHub is still the truth for that version.
