import { lazy, Suspense } from "react";
import { Routes, Route, HashRouter } from "react-router-dom";
import Modals from "./components/Modals";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useLoadAppConfig } from "./hooks/useLoadAppConfig";
import { useLoadMonitors } from "./hooks/useLoadMonitors";
import { useRealTimeImageProcessing } from "./hooks/useRealTimeImageProcessing";
import { useWindowBounds } from "./hooks/useWindowBounds";
import useNotifications from "./hooks/useNotifications";
import { ImageProcessingProgress } from "./components/ImageProcessingProgress";
import ToastContainer from "./components/ToastContainer";
import ImageDetailSidebar from "./components/ImageDetailSidebar";
import ContextMenu from "./components/ContextMenu";
import ConfirmDialog from "./components/ConfirmDialog";
import ModernAppLayout from "./components/layout/ModernAppLayout";

const Home = lazy(() => import("./routes/Home"));
const Settings = lazy(() => import("./routes/Settings"));
const Configuration = lazy(() => import("./routes/Configuration"));
const Wallhaven = lazy(() => import("./routes/Wallhaven"));

const App = () => {
	useLoadAppConfig()();
	useLoadMonitors();
	useRealTimeImageProcessing();
	useWindowBounds();
	useNotifications();
	return (
		<ThemeProvider defaultTheme="business" persist={true} syncWithSystem={true}>
			<HashRouter
				future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
			>
				<ImageProcessingProgress />
				<ToastContainer />
				<ContextMenu />
				<ConfirmDialog />
				<ModernAppLayout>
					<Suspense fallback={<div className="skeleton w-full h-full" />}>
						<Routes>
							<Route path="/" element={<Home />} />
							<Route path="/configuration" element={<Configuration />} />
							<Route path="/settings" element={<Settings />} />
							<Route path="/wallhaven" element={<Wallhaven />} />
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
