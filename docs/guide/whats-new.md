# What changed in v3

The big shift is replacing the old **Node.js** backend with a **Go daemon**: one process owns gallery state, playlist scheduling, image processing, and backend orchestration. It exposes a **chi** HTTP router on the socket, a **Cobra** CLI, a **pub/sub event bus** wired to **SSE** (`/events`), and pluggable **Go** `backend` packages. Storage is **CloverDB**; the stack is easier to test than the monolithic Node era.

**UI/UX** got a full pass: drawer layout, **font presets** and expanded **themes** (including a “neo” gallery look), clearer settings (backend **auto** and priority lists), better gallery empty states, filters, and full-viewport **studio** routes. Two tools sit on that stack—**Looper Studio** and **Shader Studio**—both **beta**; expect rough edges.

If you are migrating assumptions from older versions: treat [the API contract on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/API_CONTRACT.md) and [OpenAPI](/api/openapi) as the current surface; the daemon’s [`routes.go` on GitHub](https://github.com/0bCdian/Waypaper-Engine/blob/main/daemon/internal/server/routes.go) is the final word on which paths exist.
