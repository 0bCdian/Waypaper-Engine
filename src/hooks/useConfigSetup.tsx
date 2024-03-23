import { useEffect, useState } from 'react';
import { useAppConfigStore } from '../stores/appConfig';
import { swwwConfigStore } from '../stores/swwwConfig';
const { readAppConfig, readSwwwConfig } = window.API_RENDERER;
export function useConfigSetup() {
    const [fetched, setFetched] = useState(false);
    const { saveConfig: saveAppConfig } = useAppConfigStore();
    const { saveConfig: saveSwwwConfig } = swwwConfigStore();
    const setupConfig = async () => {
        const appConfig = await readAppConfig();
        const swwwConfig = await readSwwwConfig();
        saveAppConfig(appConfig);
        saveSwwwConfig(swwwConfig);
    };
    useEffect(() => {
        void setupConfig().then(() => {
            setFetched(true);
        });
    }, []);
    return fetched;
}
