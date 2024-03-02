import { Routes, Route, HashRouter } from "react-router-dom";
import Home from "./routes/Home";
import SwwwConfig from "./routes/SwwwConfig";
import AppConfiguration from "./routes/AppConfiguration";
import Drawer from "./components/Drawer";
import { ImagesProvider } from "./hooks/imagesStore";
import NavBar from "./components/NavBar";

const App = () => {
    return (
        <HashRouter>
            <Drawer>
                <NavBar />
                <ImagesProvider>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/swwwConfig" element={<SwwwConfig />} />
                        <Route
                            path="/appConfig"
                            element={<AppConfiguration />}
                        />
                    </Routes>
                </ImagesProvider>
            </Drawer>
        </HashRouter>
    );
};

export default App;
