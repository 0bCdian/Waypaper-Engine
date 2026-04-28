import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { useSettingsStore } from "@/stores/settingsStore";
import { useDesignSystemStore } from "@/stores/designSystemStore";
import { useShallow } from "zustand/react/shallow";
import InlineThemeSelector from "../InlineThemeSelector";
import { SettingRow, SettingSectionHeader } from "../SettingRow";
import type { ConfigSection, UnifiedConfig } from "@/shared/types/unifiedConfig";
import { normalizeFontPreset, type FontPreset } from "@/utils/appTypography";

interface AppSettingsSectionProps {
  className?: string;
}

interface BoolField {
  key: string;
  label: string;
  description: string;
}

const behaviorFields: BoolField[] = [
  {
    key: "kill_daemon_on_exit",
    label: "Kill Daemon on Exit",
    description: "Terminate the background daemon when the application closes",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Enable desktop notifications for wallpaper changes",
  },
  {
    key: "start_minimized",
    label: "Start Minimized",
    description: "Start the application minimized to system tray",
  },
  {
    key: "minimize_instead_of_close",
    label: "Minimize Instead of Close",
    description: "Minimize to tray instead of closing the application",
  },
  {
    key: "show_monitor_modal_on_start",
    label: "Show Monitor Modal on Start",
    description: "Show monitor selection modal when starting the application",
  },
  {
    key: "startup_intro",
    label: "Startup Intro",
    description:
      "Play a short full-screen sequence when opening the window (after configuration loads)",
  },
];

export const AppSettingsSection: React.FC<AppSettingsSectionProps> = ({ className = "" }) => {
  const { config, saveConfigSection, errors } = useSettingsStore(
    useShallow((s) => ({
      config: s.config,
      saveConfigSection: s.saveConfigSection,
      errors: s.errors,
    })),
  );
  const section: ConfigSection = "app";

  const [themeOpen, setThemeOpen] = useState(false);
  const [typographyOpen, setTypographyOpen] = useState(false);

  const handleChange = async (key: string, value: unknown) => {
    await saveConfigSection(section, { [key]: value });
  };

  const fieldError = (key: string) =>
    errors.find((e) => e.section === section && e.key === key)?.message;

  return (
    <div className={cn("space-y-0", className)}>
      {/* ── Section title ──────────────────────────────── */}
      <h2 className="text-lg font-semibold text-base-content mb-1">General</h2>
      <p className="text-sm text-base-content/50 mb-4">
        Application behavior, appearance, and UI preferences.
      </p>

      {/* ── Theme & Appearance ─────────────────────────── */}
      <SettingSectionHeader title="Theme & Appearance" />

      <button
        type="button"
        className="w-full flex items-center justify-between py-4 border-b border-base-content/5 group"
        onClick={() => setThemeOpen((v) => !v)}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-base-content">Application Theme</div>
          <div className="text-xs text-base-content/50 mt-0.5">
            Choose the visual theme for the application interface
          </div>
        </div>
        <svg
          className={cn(
            "w-4 h-4 text-base-content/40 transition-transform",
            themeOpen && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {themeOpen && (
        <div className="py-4 border-b border-base-content/5">
          <InlineThemeSelector onThemeChange={(themeName) => handleChange("theme", themeName)} />
        </div>
      )}

      <button
        type="button"
        className="w-full flex items-center justify-between py-4 border-b border-base-content/5 group"
        onClick={() => setTypographyOpen((v) => !v)}
      >
        <div className="text-left">
          <div className="text-sm font-medium text-base-content">Typography</div>
          <div className="text-xs text-base-content/50 mt-0.5">
            Bundled fonts, Google Sans, system UI stacks, or custom CSS family names
          </div>
        </div>
        <svg
          className={cn(
            "w-4 h-4 text-base-content/40 transition-transform",
            typographyOpen && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {typographyOpen && (
        <div className="py-4 border-b border-base-content/5 space-y-4">
          <TypographySection config={config} saveConfigSection={saveConfigSection} />
        </div>
      )}

      {/* ── Design System ───────────────────────────────── */}
      <DesignSystemSection />

      {/* ── Behavior ────────────────────────────────────── */}
      <SettingSectionHeader title="Behavior" />

      {behaviorFields.map((f) => (
        <SettingRow
          key={f.key}
          label={f.label}
          description={f.description}
          error={fieldError(f.key)}
        >
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={Boolean(config?.app?.[f.key as keyof typeof config.app])}
            onChange={(e) => handleChange(f.key, e.target.checked)}
          />
        </SettingRow>
      ))}

      {/* ── Import ─────────────────────────────────────── */}
      <SettingSectionHeader title="Import" />
      <UrlImportWarningSetting />
    </div>
  );
};

const FONT_PRESET_CHOICES: {
  value: FontPreset;
  title: string;
  description: string;
}[] = [
  {
    value: "bundled",
    title: "Shipped (Kolision)",
    description:
      "Inter, Space Grotesk, and JetBrains Mono from the app bundle (self-hosted, CSP-safe).",
  },
  {
    value: "google_sans",
    title: "Google Sans",
    description: "Bundled Google Sans Flex for UI text; JetBrains Mono for monospace.",
  },
  {
    value: "system",
    title: "Follow system",
    description: "Use the operating system UI font stacks (no bundled UI faces).",
  },
  {
    value: "custom",
    title: "Custom",
    description:
      'CSS font-family stacks per role. Use installed font family names, e.g. "Fira Sans", sans-serif. Leave a field empty to keep the shipped default for that role.',
  },
];

const TypographySection: React.FC<{
  config: UnifiedConfig | null;
  saveConfigSection: (section: ConfigSection, data: Record<string, unknown>) => Promise<void>;
}> = ({ config, saveConfigSection }) => {
  const section: ConfigSection = "app";
  const preset = normalizeFontPreset(config?.app?.font_preset);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [customBody, setCustomBody] = useState(() => config?.app?.font_family_body ?? "");
  const [customDisplay, setCustomDisplay] = useState(() => config?.app?.font_family_display ?? "");
  const [customMono, setCustomMono] = useState(() => config?.app?.font_family_mono ?? "");

  const [prevFontCfg, setPrevFontCfg] = useState({
    body: config?.app?.font_family_body ?? "",
    display: config?.app?.font_family_display ?? "",
    mono: config?.app?.font_family_mono ?? "",
  });
  const cfgBody = config?.app?.font_family_body ?? "";
  const cfgDisplay = config?.app?.font_family_display ?? "";
  const cfgMono = config?.app?.font_family_mono ?? "";
  if (
    prevFontCfg.body !== cfgBody ||
    prevFontCfg.display !== cfgDisplay ||
    prevFontCfg.mono !== cfgMono
  ) {
    setPrevFontCfg({ body: cfgBody, display: cfgDisplay, mono: cfgMono });
    setCustomBody(cfgBody);
    setCustomDisplay(cfgDisplay);
    setCustomMono(cfgMono);
  }

  const latestCustom = useRef({ body: customBody, display: customDisplay, mono: customMono });
  useEffect(() => {
    latestCustom.current = { body: customBody, display: customDisplay, mono: customMono };
  });

  const scheduleCustomSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const { body, display, mono } = latestCustom.current;
      void saveConfigSection(section, {
        font_preset: "custom",
        font_family_body: body,
        font_family_display: display,
        font_family_mono: mono,
      });
    }, 300);
  }, [saveConfigSection]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const setPreset = (value: FontPreset) => {
    void saveConfigSection(section, { font_preset: value });
  };

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="sr-only">Font preset</legend>
        {FONT_PRESET_CHOICES.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 text-left transition-colors",
              preset === opt.value
                ? "border-primary bg-primary/5"
                : "border-base-content/10 hover:border-base-content/20",
            )}
          >
            <input
              type="radio"
              name="app-font-preset"
              className="radio radio-primary mt-0.5 shrink-0"
              checked={preset === opt.value}
              onChange={() => setPreset(opt.value)}
            />
            <span>
              <span className="block text-sm font-medium text-base-content">{opt.title}</span>
              <span className="mt-0.5 block text-xs text-base-content/50">{opt.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {preset === "custom" && (
        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block text-xs font-medium text-base-content/70"
              htmlFor="font-custom-body"
            >
              Body
            </label>
            <input
              id="font-custom-body"
              type="text"
              className="input input-bordered input-sm w-full font-mono text-xs"
              value={customBody}
              onChange={(e) => {
                setCustomBody(e.target.value);
                scheduleCustomSave();
              }}
              placeholder='"Fira Sans", sans-serif'
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-base-content/70"
              htmlFor="font-custom-display"
            >
              Display / headings
            </label>
            <input
              id="font-custom-display"
              type="text"
              className="input input-bordered input-sm w-full font-mono text-xs"
              value={customDisplay}
              onChange={(e) => {
                setCustomDisplay(e.target.value);
                scheduleCustomSave();
              }}
              placeholder='"Fraunces", serif'
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium text-base-content/70"
              htmlFor="font-custom-mono"
            >
              Monospace
            </label>
            <input
              id="font-custom-mono"
              type="text"
              className="input input-bordered input-sm w-full font-mono text-xs"
              value={customMono}
              onChange={(e) => {
                setCustomMono(e.target.value);
                scheduleCustomSave();
              }}
              placeholder='"IBM Plex Mono", monospace'
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Design System Settings ──────────────────────────────────── */

const DesignSystemSection: React.FC = () => {
  const { designMode, neoConfig, setDesignMode, updateNeoConfig } = useDesignSystemStore(
    useShallow((s) => ({
      designMode: s.designMode,
      neoConfig: s.neoConfig,
      setDesignMode: s.setDesignMode,
      updateNeoConfig: s.updateNeoConfig,
    })),
  );

  const isNeo = designMode === "neobrutalist";

  return (
    <>
      <SettingSectionHeader title="Design System" />

      <SettingRow
        label="Neobrutalist Mode"
        description="Thick borders, hard shadows, bold typography on all UI elements"
      >
        <input
          type="checkbox"
          className="toggle toggle-primary"
          checked={isNeo}
          onChange={(e) => setDesignMode(e.target.checked ? "neobrutalist" : "default")}
        />
      </SettingRow>

      {isNeo && (
        <>
          <SettingRow
            label="Polaroid Image Cards"
            description="Display wallpaper thumbnails as polaroid-style frames"
          >
            <input
              type="checkbox"
              className="toggle toggle-secondary"
              checked={neoConfig.polaroidCards}
              onChange={(e) => updateNeoConfig({ polaroidCards: e.target.checked })}
            />
          </SettingRow>

          <SettingRow label="Shadow Offset" description="Hard shadow distance behind elements">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                className="range range-primary range-sm w-full lg:w-28"
                value={neoConfig.shadowOffsetX}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateNeoConfig({ shadowOffsetX: v, shadowOffsetY: v });
                }}
              />
              <span className="text-xs text-base-content/50 w-8 text-right">
                {neoConfig.shadowOffsetX}px
              </span>
            </div>
          </SettingRow>

          <SettingRow label="Border Width" description="Thickness of element borders">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                className="range range-primary range-sm w-full lg:w-28"
                value={neoConfig.borderWidth}
                onChange={(e) => updateNeoConfig({ borderWidth: Number(e.target.value) })}
              />
              <span className="text-xs text-base-content/50 w-8 text-right">
                {neoConfig.borderWidth}px
              </span>
            </div>
          </SettingRow>

          <SettingRow label="Corner Radius" description="0 for sharp corners, higher for rounded">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.125}
                className="range range-primary range-sm w-full lg:w-28"
                value={neoConfig.cornerRadius}
                onChange={(e) =>
                  updateNeoConfig({
                    cornerRadius: Number(e.target.value),
                  })
                }
              />
              <span className="text-xs text-base-content/50 w-12 text-right">
                {neoConfig.cornerRadius}rem
              </span>
            </div>
          </SettingRow>
        </>
      )}
    </>
  );
};

/* ── URL Import Warning Setting (localStorage-backed) ─────────── */

const UrlImportWarningSetting: React.FC = () => {
  const [skip, setSkip] = useState(() => localStorage.getItem("skipUrlImportWarning") === "true");

  const toggle = useCallback((checked: boolean) => {
    setSkip(checked);
    if (checked) {
      localStorage.setItem("skipUrlImportWarning", "true");
    } else {
      localStorage.removeItem("skipUrlImportWarning");
    }
  }, []);

  return (
    <SettingRow
      label="Skip URL Import Warning"
      description="When enabled, images dragged from the browser are imported without a safety prompt"
    >
      <input
        type="checkbox"
        className="toggle toggle-primary"
        checked={skip}
        onChange={(e) => toggle(e.target.checked)}
      />
    </SettingRow>
  );
};

export default AppSettingsSection;
