import Gallery from "../components/Gallery";
import { useSettingsStore } from "../stores/settingsStore";

const Home = () => {
  const hasConfig = useSettingsStore((s) => s.config != null);
  return hasConfig ? <Gallery /> : null;
};

export default Home;
