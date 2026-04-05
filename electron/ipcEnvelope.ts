type IPCEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type DaemonActionResult = {
  success: boolean;
  error?: string;
};

export function unwrapIPCResponse<T>(channel: string, response: unknown): T {
  const wrapped = response as IPCEnvelope<T>;
  if (!wrapped?.success) {
    throw new Error(wrapped?.error ?? `${channel} failed`);
  }
  return wrapped.data as T;
}

export function ensureDaemonActionSuccess(channel: string, response: unknown): void {
  const result = response as DaemonActionResult;
  if (!result || typeof result !== "object") {
    return;
  }
  if (!("success" in result)) {
    return;
  }
  if (!result.success) {
    throw new Error(result.error ?? `${channel} failed`);
  }
}
