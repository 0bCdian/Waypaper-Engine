import Gallery from '../components/Gallery';
import { useAppConfigStore } from '../stores/appConfig';
import Modals from '../components/Modals';
import { useEffect } from 'react';
import { IPC_MAIN_EVENTS } from '../../shared/constants';
let firstRender = true;
const { registerListener } = window.API_RENDERER;
const Home = () => {
    const { isSetup, requeryAppConfig } = useAppConfigStore();
    useEffect(() => {
        if (!firstRender) return;
        firstRender = false;
        registerListener({
            channel: IPC_MAIN_EVENTS.updateAppConfig,
            listener: _ => {
                void requeryAppConfig();
            }
        });
    }, []);
    if (!isSetup) return null;
    return (
        <>
            <Gallery />
            <Modals />
        </>
    );
};

export default Home;
