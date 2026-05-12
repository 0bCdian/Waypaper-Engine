import { request as httpRequest } from "node:http";

import { parseDaemonJsonBody } from "./parseDaemonJsonBody";

/** Unix-socket JSON HTTP used by all daemon domain clients. */
export class HttpTransport {
  constructor(private readonly socketPath: string) {}

  request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs: number = 30000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const options = {
        socketPath: this.socketPath,
        path,
        method,
        // Disable pooling entirely so REST never mixes responses on unix sockets with SSE/long-lived connects.
        agent: false as const,
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
        },
      };

      const req = httpRequest(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          const trimmed = data.trim().replace(/^\uFEFF/, "");
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              if (trimmed === "") {
                resolve(undefined as T);
              } else {
                resolve(parseDaemonJsonBody(trimmed) as T);
              }
            } else {
              let errorMessage = `HTTP ${res.statusCode}`;
              let errorCode: string | undefined;
              let meta: Record<string, unknown> | undefined;
              if (trimmed) {
                try {
                  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
                  const msg = parsed.error;
                  if (typeof msg === "string" && msg.length > 0) errorMessage = msg;
                  const code = parsed.error_code;
                  if (typeof code === "string") errorCode = code;
                  if (
                    parsed.meta !== undefined &&
                    typeof parsed.meta === "object" &&
                    parsed.meta !== null
                  ) {
                    meta = parsed.meta as Record<string, unknown>;
                  }
                } catch {
                  errorMessage = trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
                }
              }
              const err = new Error(errorMessage) as Error & {
                errorCode?: string;
                meta?: Record<string, unknown>;
              };
              if (errorCode !== undefined) err.errorCode = errorCode;
              if (meta !== undefined) err.meta = meta;
              reject(err);
            }
          } catch (parseError) {
            const preview = trimmed.length > 96 ? `${trimmed.slice(0, 96)}…` : trimmed;
            reject(new Error(`Failed to parse response: ${parseError} (${preview})`));
          }
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error(`Request timeout: ${method} ${path}`));
      });

      if (body !== undefined) {
        const jsonBody = JSON.stringify(body);
        req.setHeader("Content-Length", Buffer.byteLength(jsonBody));
        req.write(jsonBody);
      }

      req.end();
    });
  }

  get socket(): string {
    return this.socketPath;
  }
}
