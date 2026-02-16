import Gallery from "../components/Gallery";
import { useUnifiedConfigStore } from "../stores/unifiedConfig";
import { useEffect } from "react";
let firstRender = true;
const goDaemon = window.API_RENDERER.goDaemon;
const Home = () => {
	const { config, loadConfig } = useUnifiedConfigStore();

	useEffect(() => {
		if (!firstRender) return;
		firstRender = false;
		goDaemon.on("config_changed", () => {
			void loadConfig();
		});
	}, [loadConfig]);

	if (!config) {
		return null;
	}
	return <Gallery />;
};

export default Home;
