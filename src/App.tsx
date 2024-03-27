import { Routes, Route, HashRouter } from 'react-router-dom';
import SwwwConfig from './routes/SwwwConfig';
import AppConfiguration from './routes/AppConfiguration';
import Drawer from './components/Drawer';
import NavBar from './components/NavBar';
import Home from './routes/Home';
import { useLoadAppConfig } from './hooks/useLoadAppConfig';
const App = () => {
    useLoadAppConfig()();
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
        </HashRouter>
    );
};

export default App;
