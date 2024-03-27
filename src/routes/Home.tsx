import Gallery from '../components/Gallery';
import { useAppConfigStore } from '../stores/appConfig';
import Modals from '../components/Modals';
const Home = () => {
    const { isSetup } = useAppConfigStore();
    if (!isSetup) return null;
    return (
        <>
            <Gallery />
            <Modals />
        </>
    );
};

export default Home;
