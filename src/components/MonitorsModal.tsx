import { useEffect, useRef, useState } from "react";
import { useMonitorStore, type MonitorSelection } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";
import { MonitorComponent } from "./Monitor";
import { calculateMinResolution } from "../utils/utilities";
import type { monitorSelectType } from "../types/rendererTypes";
import { useModalStore } from "../stores/modalStore";
import NeoCloseButton from "./NeoCloseButton";

const goDaemon = window.API_RENDERER.goDaemon;

function Monitors() {
  // All hooks grouped at the top
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
  const modalRef = useRef<HTMLDialogElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const resolution = calculateMinResolution(monitorsList);

  const [prevMode, setPrevMode] = useState(monitorSelection.mode);
  if (monitorSelection.mode !== prevMode) {
    setPrevMode(monitorSelection.mode);
    setSelectType(monitorSelection.mode);
  }

  useEffect(() => {
    if (modalRef.current) {
      useModalStore.getState().register("monitors", {
        showModal: () => {
          setRefreshKey((k) => k + 1);
          void refreshFromDaemon().then(() => {
            modalRef.current?.showModal();
          });
        },
        close: () => modalRef.current?.close(),
      });
    }
    return () => useModalStore.getState().unregister("monitors");
  }, []);

  useEffect(() => {
    const disposeConnected = goDaemon.on("monitor_connected", () => {
      setTimeout(() => {
        void refreshFromDaemon().then(() => {
          useModalStore.getState().open("monitors");
        });
      }, 300);
    });

    const disposeDisconnected = goDaemon.on("monitor_disconnected", () => {
      setTimeout(() => {
        void refreshFromDaemon();
      }, 300);
    });

    return () => {
      disposeConnected();
      disposeDisconnected();
    };
  }, []);

  // All plain functions after hooks
  const closeModal = () => {
    if (modalRef.current) {
      modalRef.current.close();
    }
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

  const scale = 1 / ((monitorsList.length + 1) * (screen.availWidth / window.innerWidth));
  const isSingleMonitor = monitorsList.length === 1;
  const styles: React.CSSProperties = {
    width: isSingleMonitor ? monitorsList[0].width * scale : resolution.x * scale,
    height: isSingleMonitor ? monitorsList[0].height * scale : resolution.y * scale,
  };

  return (
    <dialog id="monitors" className="modal w-full select-none" ref={modalRef} draggable={false}>
      <div className="modal-box min-w-max">
        <NeoCloseButton onClick={closeModal} />
        <div className="m-auto flex max-w-fit flex-col justify-center gap-4 xl:gap-5 2xl:gap-6">
          <h2 className="select-none text-center text-4xl font-bold">Choose Display</h2>

          <fieldset className="fieldset bg-base-200 border border-base-300 rounded-box p-4 xl:p-5 2xl:p-6">
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
              Extend spans static images only; video, GIF, and web wallpapers use the same image on each
              monitor (clone).
            </p>
          </fieldset>

          <div style={styles} className="relative m-auto">
            {monitorsList.map((monitor) => {
              const left = isSingleMonitor ? 0 : monitor.x * scale;
              const top = isSingleMonitor ? 0 : monitor.y * scale;

              return (
                <div
                  draggable={false}
                  style={{
                    position: "absolute",
                    left,
                    top,
                  }}
                  key={monitor.name}
                >
                  <MonitorComponent
                    monitorsList={monitorsList}
                    monitor={monitor}
                    selectType={selectType}
                    scale={scale * 0.99}
                    refreshKey={refreshKey}
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
              className="btn btn-primary btn-wide xl:btn-lg rounded-md text-xl"
            >
              Save
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={closeModal}>
          close
        </button>
      </form>
    </dialog>
  );
}

export default Monitors;
