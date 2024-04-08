import { useEffect, useRef, useState } from 'react';
import { useMonitorStore } from '../stores/monitors';
import { MonitorComponent } from './Monitor';
import { calculateMinResolution } from '../utils/utilities';
import { type monitorSelectType } from '../types/rendererTypes';
import { type Monitor } from '../../shared/types/monitor';
import { IPC_MAIN_EVENTS } from '../../shared/constants';
const { setSelectedMonitor, registerListener } = window.API_RENDERER;
let firstRender = true;
function Monitors() {
    const {
        activeMonitor,
        monitorsList,
        setMonitorsList,
        setActiveMonitor,
        reQueryMonitors
    } = useMonitorStore();
    let initialSelectState: monitorSelectType =
        monitorsList.length > 1 ? 'clone' : 'individual';
    if (activeMonitor.extendAcrossMonitors) {
        initialSelectState = 'extend';
    } else if (activeMonitor.monitors.length === 1) {
        initialSelectState = 'individual';
    }
    const [selectType, setSelectType] =
        useState<monitorSelectType>(initialSelectState);
    const [error, setError] = useState<{ state: boolean; message: string }>({
        state: false,
        message: 'error'
    });
    const closeModal = () => {
        modalRef.current?.close();
    };
    const [resolution, setResolution] = useState<{ x: number; y: number }>({
        x: 0,
        y: 0
    });
    const onSubmit = () => {
        const extend = selectType === 'extend';
        let name: string = selectType + ':';
        const selectedMonitors: Monitor[] = [];
        monitorsList.forEach(monitor => {
            if (!monitor.isSelected) return;
            name = name.concat(' ', monitor.name, ',');
            const { isSelected, ...selectedMonitor } = monitor;
            selectedMonitors.push(selectedMonitor);
        });
        if (selectedMonitors.length === 0) {
            setError({ state: true, message: 'Select at least one display' });
            setTimeout(() => {
                setError(prevError => {
                    return { ...prevError, state: false };
                });
            }, 3000);
            return;
        }
        if (selectType === 'individual' && selectedMonitors.length > 1) {
            setError({
                state: true,
                message: 'Cannot select more than one display in this mode'
            });
            setTimeout(() => {
                setError(prevError => {
                    return { ...prevError, state: false };
                });
            }, 3000);
            return;
        }
        if (
            (selectType === 'clone' || selectType === 'extend') &&
            selectedMonitors.length < 2
        ) {
            setError({ state: true, message: 'Select at least two displays' });
            setTimeout(() => {
                setError(prevError => {
                    return { ...prevError, state: false };
                });
            }, 3000);
            return;
        }
        name = name.slice(0, name.length - 1);
        const activeMonitor = {
            name,
            monitors: selectedMonitors,
            extendAcrossMonitors: extend
        };
        setSelectedMonitor(activeMonitor);
        setActiveMonitor(activeMonitor);
        closeModal();
    };
    const scale = 1 / (monitorsList.length + 1);
    const modalRef = useRef<HTMLDialogElement>(null);
    const styles: React.CSSProperties = {
        width: resolution.x * scale,
        height: resolution.y * scale
    };
    useEffect(() => {
        const res = calculateMinResolution(monitorsList);
        setResolution(res);
    }, [monitorsList]);
    useEffect(() => {
        if (monitorsList.length < 1) return;
        if (selectType === 'individual') {
            const resetMonitors = monitorsList.map((monitor, index) => {
                monitor.isSelected = index === 0;
                return monitor;
            });
            setMonitorsList(resetMonitors);
        } else {
            monitorsList[0].isSelected = true;
            setMonitorsList([...monitorsList]);
        }
    }, [selectType]);

    useEffect(() => {
        if (!firstRender) return;
        firstRender = false;
        registerListener({
            channel: IPC_MAIN_EVENTS.displaysChanged,
            listener: _ => {
                // this setTimeout is added to circumvent an swww limitation on querying recently inserted monitorsList
                //  which sets currentImage to 00000 instead of the actual cached image
                setTimeout(() => {
                    void reQueryMonitors().then(() => {
                        // @ts-expect-error daisy-ui
                        window.monitors.showModal();
                    });
                }, 300);
            }
        });
    }, []);
    return (
        <dialog id="monitors" className="modal w-full" ref={modalRef}>
            <div className="modal-box min-w-max">
                <div className="max-w-fit m-auto flex flex-col justify-center">
                    <h2 className="font-bold text-4xl text-center py-3">
                        Choose Display
                    </h2>
                    <div className="form-control">
                        <select
                            defaultValue={initialSelectState}
                            onChange={e => {
                                setSelectType(
                                    e.currentTarget.value as monitorSelectType
                                );
                            }}
                            className="select w-full max-w-full text-center text-xl"
                        >
                            <option value={'individual'}>
                                Wallpaper per display
                            </option>
                            <option
                                value={'extend'}
                                disabled={monitorsList.length < 2}
                            >
                                Stretch single wallpaper
                            </option>
                            <option
                                value={'clone'}
                                disabled={monitorsList.length < 2}
                            >
                                Clone single wallpaper
                            </option>
                        </select>
                        <div className="divider"></div>
                        <div style={styles} className="relative m-auto ">
                            {monitorsList.map(monitor => {
                                return (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: monitor.position.x * scale,
                                            top: monitor.position.y * scale
                                        }}
                                        key={monitor.name}
                                    >
                                        <MonitorComponent
                                            monitorsList={monitorsList}
                                            monitor={monitor}
                                            selectType={selectType}
                                            scale={scale * 0.99}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="divider "></div>
                        <span
                            data-error={error.state}
                            className="m-auto text-2xl text-center mb-4 text-error transition-all duration-300 italic opcacity-0 invisible data-[error=true]:visible data-[error=true]:opacity-100"
                        >
                            {error.message}
                        </span>

                        <button
                            onClick={onSubmit}
                            className="btn m-auto btn-wide btn-primary rounded-md text-xl"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </dialog>
    );
}
export default Monitors;
