/**
 * Daemon Status Component
 *
 * Displays real-time daemon status with health checks and restart functionality.
 */

import type React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/utils/cn";

interface DaemonStatus {
  isRunning: boolean;
  lastChecked: number;
  lastError?: string;
}

interface DaemonStatusComponentProps {
  className?: string;
}

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

export const DaemonStatusComponent: React.FC<DaemonStatusComponentProps> = ({ className }) => {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      if (window.API_RENDERER?.getDaemonStatus) {
        const response = (await window.API_RENDERER.getDaemonStatus()) as DaemonStatus;
        setStatus(response);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load daemon status");
    }
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

  const handleRestart = async () => {
    setIsLoading(true);
    setError(null);
    const api = window.API_RENDERER;
    const fn = api?.restartDaemon ? () => api.restartDaemon() : undefined;
    const errorMsg = await executeDaemonAction(fn, "Failed to restart daemon");
    if (errorMsg) setError(errorMsg);
    setIsLoading(false);
  };

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    const api = window.API_RENDERER;
    const fn = api?.startDaemon ? () => api.startDaemon() : undefined;
    const errorMsg = await executeDaemonAction(fn, "Failed to start daemon");
    if (errorMsg) setError(errorMsg);
    setIsLoading(false);
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);
    const api = window.API_RENDERER;
    const fn = api?.stopDaemon ? () => api.stopDaemon() : undefined;
    const errorMsg = await executeDaemonAction(fn, "Failed to stop daemon");
    if (errorMsg) setError(errorMsg);
    setIsLoading(false);
  };

  const formatLastChecked = (timestamp: number | string) => {
    const now = Date.now();
    const timestampNum = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;

    if (Number.isNaN(timestampNum)) {
      return "Unknown";
    }

    const diff = now - timestampNum;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 5) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!status) {
    return (
      <div className={cn("card bg-base-200 shadow-sm", className)}>
        <div className="card-body">
          <div className="flex items-center justify-center">
            <div className="loading loading-spinner loading-sm"></div>
            <span className="ml-2 text-sm text-base-content/60">Loading daemon status...</span>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className={cn("w-3 h-3 rounded-full", status.isRunning ? "bg-success" : "bg-error")}
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default DaemonStatusComponent;
