/**
 * Daemon Status Component
 *
 * Displays real-time daemon status with health checks and restart functionality.
 */

import type React from "react";
import { useReducer, useEffect } from "react";
import { cn } from "@/utils/cn";

interface DaemonStatus {
  isRunning: boolean;
  lastChecked: number;
  lastError?: string;
}

interface DaemonStatusComponentProps {
  className?: string;
}

type State = {
  status: DaemonStatus | null;
  isLoading: boolean;
  error: string | null;
};

type Action =
  | { type: "status-loaded"; status: DaemonStatus }
  | { type: "action-start" }
  | { type: "action-end"; error: string | null }
  | { type: "error"; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "status-loaded":
      return { ...state, status: action.status, error: null };
    case "action-start":
      return { ...state, isLoading: true, error: null };
    case "action-end":
      return { ...state, isLoading: false, error: action.error };
    case "error":
      return { ...state, error: action.error };
  }
}

const INITIAL_STATE: State = { status: null, isLoading: false, error: null };

async function executeDaemonAction(
  action: (() => Promise<unknown>) | undefined,
  fallbackError: string,
): Promise<string | null> {
  if (!action) return null;
  try {
    await action();
    return null;
  } catch (err) {
    if (err instanceof Error) return err.message;
    return fallbackError;
  }
}

function formatLastChecked(timestamp: number | string): string {
  const now = Date.now();
  const timestampNum = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  if (Number.isNaN(timestampNum)) return "Unknown";
  const diff = now - timestampNum;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

async function fetchDaemonStatus(): Promise<DaemonStatus | null> {
  try {
    if (window.API_RENDERER?.getDaemonStatus) {
      return (await window.API_RENDERER.getDaemonStatus()) as DaemonStatus;
    }
    return null;
  } catch {
    return null;
  }
}

export const DaemonStatusComponent: React.FC<DaemonStatusComponentProps> = ({ className }) => {
  const [{ status, isLoading, error }, dispatch] = useReducer(reducer, INITIAL_STATE);

  const loadStatus = () => {
    fetchDaemonStatus()
      .then((result) => {
        if (result) {
          dispatch({ type: "status-loaded", status: result });
        }
      })
      .catch((err) => {
        dispatch({
          type: "error",
          error: err instanceof Error ? err.message : "Failed to load daemon status",
        });
      });
  };

  // Load initial status
  useEffect(() => {
    loadStatus();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const runDaemonAction = async (fn: (() => Promise<unknown>) | undefined, label: string) => {
    dispatch({ type: "action-start" });
    const errorMsg = await executeDaemonAction(fn, label);
    dispatch({ type: "action-end", error: errorMsg });
  };

  const handleRestart = () => {
    const api = window.API_RENDERER;
    void runDaemonAction(
      api?.restartDaemon ? () => api.restartDaemon() : undefined,
      "Failed to restart daemon",
    );
  };

  const handleStart = () => {
    const api = window.API_RENDERER;
    void runDaemonAction(
      api?.startDaemon ? () => api.startDaemon() : undefined,
      "Failed to start daemon",
    );
  };

  const handleStop = () => {
    const api = window.API_RENDERER;
    void runDaemonAction(
      api?.stopDaemon ? () => api.stopDaemon() : undefined,
      "Failed to stop daemon",
    );
  };

  if (!status) {
    return (
      <div className={cn("card bg-base-200 shadow-sm", className)}>
        <div className="card-body">
          <div className="flex items-center justify-center">
            <div className="loading loading-spinner loading-sm"></div>
            <span className="ml-2 text-sm text-base-content/60">Loading daemon status…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("card bg-base-200 shadow-sm", className)}>
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Daemon Status
          </h3>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={cn("size-3 rounded-full", status.isRunning ? "bg-success" : "bg-error")}
            ></div>
            <span
              className={cn(
                "text-sm font-medium",
                status.isRunning ? "text-success" : "text-error",
              )}
            >
              {status.isRunning ? "Running" : "Stopped"}
            </span>
          </div>
        </div>

        {/* Status details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-base-content/70">Last checked:</span>
            <span className="text-base-content">{formatLastChecked(status.lastChecked)}</span>
          </div>

          {status.lastError && (
            <div className="mt-3 p-2 bg-error/10 border border-error/20 rounded">
              <div className="text-error text-sm">
                <strong>Error:</strong> {status.lastError}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 p-2 bg-error/10 border border-error/20 rounded">
              <div className="text-error text-sm">
                <strong>Operation failed:</strong> {error}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="card-actions justify-end mt-4">
          {status.isRunning ? (
            <button onClick={handleStop} className="btn btn-sm btn-error" disabled={isLoading}>
              {isLoading ? (
                <div className="loading loading-spinner loading-xs"></div>
              ) : (
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
              )}
              Stop
            </button>
          ) : (
            <button onClick={handleStart} className="btn btn-sm btn-success" disabled={isLoading}>
              {isLoading ? (
                <div className="loading loading-spinner loading-xs"></div>
              ) : (
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z"
                  />
                </svg>
              )}
              Start
            </button>
          )}

          <button onClick={handleRestart} className="btn btn-sm btn-warning" disabled={isLoading}>
            {isLoading ? (
              <div className="loading loading-spinner loading-xs"></div>
            ) : (
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            Restart
          </button>
        </div>
      </div>
    </div>
  );
};
