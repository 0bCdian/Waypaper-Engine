import { request as httpRequest } from "node:http";

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
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = httpRequest(options, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              if (data.trim() === "") {
                resolve(undefined as T);
              } else {
                resolve(JSON.parse(data) as T);
              }
            } else {
              const errorData = data ? JSON.parse(data) : { error: `HTTP ${res.statusCode}` };
              const err = new Error(errorData.error || `HTTP ${res.statusCode}`) as Error & {
                errorCode?: string;
                meta?: Record<string, unknown>;
              };
              if (errorData.error_code) err.errorCode = errorData.error_code;
              if (errorData.meta) err.meta = errorData.meta;
              reject(err);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`));
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
