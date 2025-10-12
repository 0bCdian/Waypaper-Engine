import { Routes, Route, HashRouter } from "react-router-dom";
import Configuration from "./routes/Configuration";
import Drawer from "./components/Drawer";
import NavBar from "./components/NavBar";
import Home from "./routes/Home";
import Modals from "./components/Modals";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useLoadAppConfig } from "./hooks/useLoadAppConfig";
import { useLoadMonitors } from "./hooks/useLoadMonitors";
import { useRealTimeImageProcessing } from "./hooks/useRealTimeImageProcessing";
import { useWindowBounds } from "./hooks/useWindowBounds";
import useContextMenuEvents from "./hooks/useContextMenuEvents";
import { ImageProcessingProgress } from "./components/ImageProcessingProgress";
import ToastContainer from "./components/ToastContainer";

const App = () => {
    useLoadAppConfig()();
    useLoadMonitors();
    useRealTimeImageProcessing();
    useWindowBounds();
    useContextMenuEvents();
    
    return (
        <ThemeProvider defaultTheme="dark" persist={true} syncWithSystem={true}>
            <HashRouter>
                <ImageProcessingProgress />
                <ToastContainer />
                <Drawer>
                    <NavBar />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/configuration" element={<Configuration />} />
                    </Routes>
                </Drawer>
                <Modals />
            </HashRouter>
        </ThemeProvider>
    );
};

export default App;