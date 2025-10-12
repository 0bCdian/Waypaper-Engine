import { useMonitorStore } from "../stores/monitors";
import { ThemeSelector } from "./ThemeSelector";

declare global {
    interface Window {
        monitors?: {
            showModal: () => void;
            close: () => void;
        };
    }
}
const NavBar = () => {
    const { activeMonitor, reQueryMonitors } = useMonitorStore();
    return (
        <div className="navbar mb-2 bg-base-100 theme-transition">
            <div className="navbar-start">
                <div className="dropdown">
                    <label
                        htmlFor="my-drawer"
                        tabIndex={0}
                        className="btn btn-circle btn-ghost"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-10 w-10"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                d="M4 6h16M4 12h16M4 18h7"
                            />
                        </svg>
                    </label>
                </div>
            </div>
            <div className="navbar-center">
                {
                    <button
                        className="btn w-full text-ellipsis rounded-lg text-2xl"
                        onClick={async () => {
                            console.log("🔵 NavBar: Button clicked");
                            console.log("🔵 NavBar: window.monitors =", window.monitors);
                            
                            // Always try to refresh monitors first to ensure we have the latest state
                            try {
                                await reQueryMonitors();
                                console.log("🔵 NavBar: reQueryMonitors completed, window.monitors =", window.monitors);
                                
                                // Wait a bit for the modal ref to be set
                                await new Promise(resolve => setTimeout(resolve, 100));
                                
                                if (window.monitors) {
                                    console.log("🔵 NavBar: Calling window.monitors.showModal()");
                                    window.monitors.showModal();
                                } else {
                                    console.log("🔵 NavBar: window.monitors still undefined after reQueryMonitors");
                                }
                            } catch (error) {
                                console.error("🔵 NavBar: Error loading monitors:", error);
                            }
                        }}
                    >
                        {activeMonitor.name.length > 0
                            ? activeMonitor.name
                            : "select display"}
                    </button>
                }
            </div>
            <div className="navbar-end">
                <ThemeSelector className="mr-2" />
            </div>
        </div>
    );
};

export default NavBar;
