import { Routes, Route, HashRouter } from 'react-router-dom';
import SwwwConfig from './routes/SwwwConfig';
import AppConfiguration from './routes/AppConfiguration';
import Drawer from './components/Drawer';
import { useEffect, useState, lazy, Suspense } from 'react';
import { SHORTCUT_EVENTS } from '../shared/constants';
import { imagesStore } from './stores/images';
import playlistStore from './stores/playlist';
import { useMonitorStore } from './stores/monitors';
import { useConfigSetup } from './hooks/useConfigSetup';
import { setLastActivePlaylist } from './hooks/useSetLastActivePlaylist';
const { registerShortcutListener } = window.API_RENDERER;
const NavBar = lazy(async () => await import('./components/NavBar'));
const Home = lazy(async () => await import('./routes/Home'));
const { onDeleteImageFromGallery } = window.API_RENDERER;
const App = () => {
    const [firstRender, setFirstRender] = useState(true);
    const { removeImageFromStore } = imagesStore();
    const { removeImageFromPlaylist } = playlistStore();
    const { reQueryImages } = imagesStore();
    const { reQueryMonitors, reQuerySelectedMonitor } = useMonitorStore();
    const isConfigSetup = useConfigSetup();
    setLastActivePlaylist();
    useEffect(() => {
        if (!firstRender) return;
        setFirstRender(true);
        registerShortcutListener([
            {
                event: SHORTCUT_EVENTS.selectAllImagesInGallery,
                callback: _event => {
                    console.log('CTRIL_A');
                }
            }
        ]);
        onDeleteImageFromGallery((_e, image) => {
            removeImageFromStore(image.id);
            removeImageFromPlaylist(image);
        });
        reQueryImages();
        reQuerySelectedMonitor();
        void reQueryMonitors();
    }, []);
    if (!isConfigSetup)
        return <span className="loading loading-dots loading-lg"></span>;
    return (
        <HashRouter>
            <Drawer>
                <Suspense>
                    <NavBar />
                </Suspense>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Suspense>
                                <Home />
                            </Suspense>
                        }
                    />
                    <Route path="/swwwConfig" element={<SwwwConfig />} />
                    <Route path="/appConfig" element={<AppConfiguration />} />
                </Routes>
            </Drawer>
        </HashRouter>
    );
};

export default App;
