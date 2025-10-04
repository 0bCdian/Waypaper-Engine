import { Routes, Route, HashRouter } from "react-router-dom";
import SwwwConfig from "./routes/SwwwConfig";
import AppConfiguration from "./routes/AppConfiguration";
import Drawer from "./components/Drawer";
import NavBar from "./components/NavBar";
import Home from "./routes/Home";
import Modals from "./components/Modals";
import { useLoadAppConfig } from "./hooks/useLoadAppConfig";
import { useLoadMonitors } from "./hooks/useLoadMonitors";
import { useRealTimeImageProcessing } from "./hooks/useRealTimeImageProcessing";
import { useWindowBounds } from "./hooks/useWindowBounds";
import useContextMenuEvents from "./hooks/useContextMenuEvents";
const App = () => {
    useLoadAppConfig()();
    useLoadMonitors();
    useRealTimeImageProcessing();
    useWindowBounds();
    useContextMenuEvents();
    return (
        <HashRouter>
            <Drawer>
                <NavBar />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/swwwConfig" element={<SwwwConfig />} />
                    <Route path="/appConfig" element={<AppConfiguration />} />
                </Routes>
            </Drawer>
            <Modals />
        </HashRouter>
    );
};

export default App;
