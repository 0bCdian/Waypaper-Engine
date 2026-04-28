import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, HashRouter } from "react-router-dom";
import Modals from "./components/Modals";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useLoadAppConfig } from "./hooks/useLoadAppConfig";
import { useSyncAppTypography } from "./hooks/useSyncAppTypography";
import { useLoadMonitors } from "./hooks/useLoadMonitors";
import { useRealTimeImageProcessing } from "./hooks/useRealTimeImageProcessing";
import useNotifications from "./hooks/useNotifications";
import { ImageProcessingProgress } from "./components/ImageProcessingProgress";
import ToastContainer from "./components/ToastContainer";
import ImageDetailSidebar from "./components/ImageDetailSidebar";
import ContextMenu from "./components/ContextMenu";
import ConfirmDialog from "./components/ConfirmDialog";
import ModernAppLayout from "./components/layout/ModernAppLayout";
import { useSettingsModalStore } from "./stores/settingsModalStore";

const Home = lazy(() => import("./routes/Home"));
const Wallhaven = lazy(() => import("./routes/Wallhaven"));
const History = lazy(() => import("./routes/History"));
const LoopStudio = lazy(() => import("./routes/LoopStudio"));
const ShaderStudio = lazy(() => import("./routes/ShaderStudio"));

function SettingsShortcut() {
  const openModal = useSettingsModalStore((s) => s.openModal);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        openModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openModal]);
  return null;
}

const App = () => {
  useLoadAppConfig()();
  useSyncAppTypography();
  useLoadMonitors();
  useRealTimeImageProcessing();
  useNotifications();
  return (
    <ThemeProvider defaultTheme="kolision-raw" persist={true} syncWithSystem={true}>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SettingsShortcut />
        <ImageProcessingProgress />
        <ToastContainer />
        <ContextMenu />
        <ConfirmDialog />
        <ModernAppLayout>
          <Suspense fallback={<div className="skeleton w-full h-full" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/wallhaven" element={<Wallhaven />} />
              <Route path="/history" element={<History />} />
              <Route path="/loop-studio" element={<LoopStudio />} />
              <Route path="/shader-studio" element={<ShaderStudio />} />
            </Routes>
          </Suspense>
        </ModernAppLayout>
        <Modals />
        <ImageDetailSidebar />
      </HashRouter>
    </ThemeProvider>
  );
};

export default App;
