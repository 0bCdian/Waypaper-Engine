import Gallery from "../components/Gallery";
import { useAppConfigStore } from "../stores/appConfig";
import { useEffect } from "react";
let firstRender = true;
const goDaemon = window.API_RENDERER.goDaemon;
const Home = () => {
    const { isSetup, requeryAppConfig } = useAppConfigStore();
    useEffect(() => {
        if (!firstRender) return;
        firstRender = false;
        console.log("🔵 Home: Component mounted, isSetup:", isSetup);
        goDaemon.on("config_updated", () => {
            console.log("🔵 Home: Config updated event received");
            void requeryAppConfig();
        });
    }, []);

    console.log("🔵 Home: Rendering, isSetup:", isSetup);
    if (!isSetup) {
        console.log("🔵 Home: Not setup yet, returning null");
        return null;
    }
    console.log("🔵 Home: Setup complete, rendering Gallery");
    return <Gallery />;
};

export default Home;
