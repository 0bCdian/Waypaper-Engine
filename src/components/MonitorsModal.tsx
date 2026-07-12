import { useEffect, useRef, useState } from "react";
import { useMonitorStore, type MonitorSelection } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { MonitorComponent } from "./Monitor";
import { fitMonitorLayout } from "../utils/utilities";
import type { monitorSelectType } from "../types/rendererTypes";
import { useModalStore } from "../stores/modalStore";
import Modal, { type ModalHandle } from "./Modal";
import { cn } from "../utils/cn";
import { daemonClient } from "@/client";
import { useLiveWallpapers } from "../hooks/useLiveWallpapers";

function Monitors() {
  const { monitorSelection, monitorsList, setMonitorSelection, refreshFromDaemon } =
    useMonitorStore(
      useShallow((s) => ({
        monitorSelection: s.monitorSelection,
        monitorsList: s.monitorsList,
        setMonitorSelection: s.setMonitorSelection,
        refreshFromDaemon: s.refreshFromDaemon,
      })),
    );
  const [selectType, setSelectType] = useState<monitorSelectType>(
    monitorSelection.mode || "individual",
  );
  const [error, setError] = useState<{ state: boolean; message: string }>({
    state: false,
    message: "error",
  });
  const modalRef = useRef<ModalHandle>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const live = useLiveWallpapers(monitorsList, refreshKey);

  const prevModeRef = useRef(monitorSelection.mode);
  if (monitorSelection.mode !== prevModeRef.current) {
    prevModeRef.current = monitorSelection.mode;
    setSelectType(monitorSelection.mode);
  }

  useEffect(() => {
    if (modalRef.current) {
      useModalStore.getState().register("monitors", {
        showModal: () => {
          void refreshFromDaemon().then(() => {
            setRefreshKey((k) => k + 1);
            modalRef.current?.showModal();
          });
        },
        close: () => modalRef.current?.close(),
      });
    }
    return () => useModalStore.getState().unregister("monitors");
  }, []);

  useEffect(() => {
    const disposeConnected = daemonClient.on("monitor_connected", () => {
      setTimeout(() => {
        void refreshFromDaemon().then(() => {
          useModalStore.getState().open("monitors");
        });
      }, 300);
    });

    const disposeDisconnected = daemonClient.on("monitor_disconnected", () => {
      setTimeout(() => {
        void refreshFromDaemon();
      }, 300);
    });

    return () => {
      disposeConnected();
      disposeDisconnected();
    };
  }, []);

  const closeModal = () => {
    modalRef.current?.close();
  };

  const onSubmit = async () => {
    const selectedMonitors: string[] = [];
    monitorsList.forEach((monitor) => {
      if (!monitor.isSelected) return;
      selectedMonitors.push(monitor.name);
    });

    if (selectedMonitors.length === 0) {
      setError({ state: true, message: "Select at least one display" });
      setTimeout(() => {
        setError((prev) => ({ ...prev, state: false }));
      }, 3000);
      return;
    }

    if (selectType === "individual" && selectedMonitors.length > 1) {
      setError({
        state: true,
        message: "Cannot select more than one display in this mode",
      });
      setTimeout(() => {
        setError((prev) => ({ ...prev, state: false }));
      }, 3000);
      return;
    }

    if ((selectType === "clone" || selectType === "extend") && selectedMonitors.length < 2) {
      setError({ state: true, message: "Select at least two displays" });
      setTimeout(() => {
        setError((prev) => ({ ...prev, state: false }));
      }, 3000);
      return;
    }

    const newSelection: MonitorSelection = {
      selectedMonitors,
      mode: selectType,
    };
    setMonitorSelection(newSelection);
    closeModal();
  };

  const previewBox = {
    width: Math.min(window.innerWidth * 0.7, 920),
    height: Math.min(window.innerHeight * 0.55, 480),
  };
  const layout = fitMonitorLayout(monitorsList, previewBox);
  const styles: React.CSSProperties = {
    width: layout.width,
    height: layout.height,
  };

  const neoFieldset = cn(
    "fieldset bg-base-200 p-4 xl:p-5 2xl:p-6",
    "rounded-[var(--wp-radius-md)] border-[length:var(--wp-border-w)] border-[var(--wp-border-color)]",
  );

  return (
    <Modal
      id="monitors"
      ref={modalRef}
      draggable={false}
      stripedHeader={{
        title: "Choose Display",
        subtitle: "Pick which outputs get wallpapers and whether they mirror or stretch together.",
        bleedInsetDefault: false,
      }}
      className="modal-box flex min-w-max flex-col max-h-[92vh] overflow-hidden p-0"
    >
      <div className="m-auto flex max-w-fit flex-col justify-center gap-6 xl:gap-7 2xl:gap-8 max-h-none min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-8 md:px-8 md:pt-10">
        <fieldset className={neoFieldset}>
          <legend className="fieldset-legend text-base 2xl:text-lg">Display Mode</legend>
          <select
            value={selectType}
            onChange={(e) => {
              setSelectType(e.currentTarget.value as monitorSelectType);
            }}
            className="select select-bordered w-full text-center text-lg xl:text-xl"
          >
            <option value="individual">Wallpaper per display</option>
            <option value="extend" disabled={monitorsList.length < 2}>
              Stretch single wallpaper
            </option>
            <option value="clone" disabled={monitorsList.length < 2}>
              Clone single wallpaper
            </option>
          </select>
          <p className="mt-2 text-xs text-base-content/70">
            Extend spans static images only; video, GIF, and web wallpapers use the same image on
            each monitor (clone).
          </p>
        </fieldset>

        <div style={styles} data-testid="monitor-layout" className="relative m-auto">
          {monitorsList.map((monitor, index) => {
            const left = (monitor.x - layout.origin.x) * layout.scale;
            const top = (monitor.y - layout.origin.y) * layout.scale;
            const key = `m-${index}-${monitor.x}-${monitor.y}-${monitor.width}x${monitor.height}-${monitor.refresh_rate}-${monitor.transform}`;

            return (
              <div
                draggable={false}
                style={{
                  position: "absolute",
                  left,
                  top,
                }}
                key={key}
              >
                <MonitorComponent
                  monitorsList={monitorsList}
                  monitor={monitor}
                  selectType={selectType}
                  scale={layout.scale * 0.99}
                  live={live}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <span
            data-error={error.state}
            className="h-8 select-none text-center text-xl italic text-error opacity-0 transition-opacity duration-300 data-[error=true]:opacity-100 xl:text-2xl"
          >
            {error.message}
          </span>

          <button
            type="button"
            onClick={onSubmit}
            className="btn btn-primary btn-wide text-xl xl:btn-lg rounded-[var(--wp-radius-md)]"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default Monitors;
