import { request as httpRequest } from "node:http";
import type { Plugin } from "vite";

import { configReader } from "../globals/configReader";

/** Stripped from forwarded requests (hop-by-hop). */
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
]);

function forwardRequestHeaders(
  headers: NodeJS.IncomingHttpHeaders,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/**
 * During `vite serve`, the renderer loads from `localhost:5173` while the Go daemon
 * only speaks HTTP over a Unix socket. Without this, `fetch("/api/...")` hits Vite and
 * returns the SPA `index.html` (breaking JSON/CSS routes like `/api/themes`).
 */
export function daemonUnixSocketProxyPlugin(): Plugin {
  return {
    name: "wp-daemon-unix-proxy",
    enforce: "pre",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api")) {
          next();
          return;
        }

        const socketPath = configReader.getSocketPath();
        const proxyReq = httpRequest(
          {
            socketPath,
            path: url,
            method: req.method,
            headers: forwardRequestHeaders(req.headers),
            agent: false,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );

        proxyReq.on("error", () => {
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          }
          res.end("Daemon unreachable (unix socket proxy). Is waypaper-daemon running?");
        });

        req.on("aborted", () => proxyReq.destroy());
        req.pipe(proxyReq);
      });
    },
  };
}
