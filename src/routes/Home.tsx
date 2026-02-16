import Gallery from "../components/Gallery";
import { useSettingsStore } from "../stores/settingsStore";

const Home = () => {
	const config = useSettingsStore((s) => s.config);

	if (!config) {
		return null;
	}
	return <Gallery />;
};

export default Home;
