import { Routes, Route, HashRouter } from "react-router-dom";
import Configuration from "./routes/Configuration";
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
import ModernAppLayout from "./components/layout/ModernAppLayout";

const App = () => {
    useLoadAppConfig()();
    useLoadMonitors();
    useRealTimeImageProcessing();
    useWindowBounds();
    useContextMenuEvents();
    return (
        <ThemeProvider defaultTheme="business" persist={true} syncWithSystem={true}>
            <HashRouter>
                <ImageProcessingProgress />
                <ToastContainer />
                <ModernAppLayout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/configuration" element={<Configuration />} />
                    </Routes>
                </ModernAppLayout>
                <Modals />
            </HashRouter>
        </ThemeProvider>
    );
};

export default App;