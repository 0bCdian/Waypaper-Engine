import type React from "react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import { WallhavenDisclaimerModal } from "@/components/WallhavenDisclaimerModal";

interface WallhavenSettingsSectionProps {
  className?: string;
}

const WallhavenSettingsSection: React.FC<WallhavenSettingsSectionProps> = ({ className }) => {
  const { config, saveConfigSection } = useSettingsStore(
    useShallow((s) => ({
      config: s.config,
      saveConfigSection: s.saveConfigSection,
    })),
  );

  const [showKey, setShowKey] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  if (!config) return null;

  const wallhaven = config.wallhaven ?? { api_key: "", enabled: false };

  const handleTestConnection = async () => {
    const key = wallhaven.api_key;
    if (!key) {
      setTestStatus("error");
      setTestMessage("Please enter an API key first.");
      return;
    }

    setTestStatus("loading");
    setTestMessage("");

    try {
      await window.API_RENDERER.wallhaven.testApiKey(key);
      setTestStatus("success");
      setTestMessage("API key is valid.");
    } catch (err) {
      setTestStatus("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("401")) {
        setTestMessage("Invalid API key.");
      } else {
        setTestMessage(msg);
      }
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <SettingSectionHeader
        title="Wallhaven"
        description="Browse and download wallpapers from wallhaven.cc"
      />

      <SettingRow
        label="Enable Wallhaven"
        description="Show the Wallhaven page in the sidebar for browsing wallpapers"
      >
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={wallhaven.enabled}
          onChange={(e) => {
            if (e.target.checked) {
              setShowDisclaimer(true);
            } else {
              void saveConfigSection("wallhaven", { enabled: false });
            }
          }}
        />
      </SettingRow>

      <SettingRow
        label="API Key"
        description="Your Wallhaven API key. Required for NSFW content and favorites. Found at wallhaven.cc/settings/account."
        stacked
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              className="input input-bordered w-full pr-10 text-sm font-mono"
              placeholder="Enter your Wallhaven API key"
              value={wallhaven.api_key}
              onChange={(e) => void saveConfigSection("wallhaven", { api_key: e.target.value })}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          <button
            type="button"
            className={cn(
              "btn btn-sm btn-outline shrink-0",
              testStatus === "loading" && "btn-disabled",
            )}
            onClick={() => void handleTestConnection()}
          >
            {testStatus === "loading" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Test"
            )}
          </button>
        </div>
        {testMessage && (
          <div
            className={cn(
              "text-xs mt-1.5",
              testStatus === "success" ? "text-success" : "text-error",
            )}
          >
            {testMessage}
          </div>
        )}
      </SettingRow>

      <WallhavenDisclaimerModal
        isOpen={showDisclaimer}
        onConfirm={() => {
          setShowDisclaimer(false);
          void saveConfigSection("wallhaven", { enabled: true });
        }}
        onCancel={() => setShowDisclaimer(false)}
      />
    </div>
  );
};

export default WallhavenSettingsSection;
