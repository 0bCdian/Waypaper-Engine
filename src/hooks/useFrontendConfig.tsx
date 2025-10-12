import { useEffect, useState } from 'react';

export const useFrontendConfig = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                // Use the unified config system via goDaemon
                if (window.API_RENDERER?.goDaemon?.getAppConfig) {
                    const loadedConfig = await window.API_RENDERER.goDaemon.getAppConfig();
                    setConfig(loadedConfig);
                    setIsLoaded(true);
                    console.log('🟢 FrontendConfig: Config loaded successfully from unified system');
                } else {
                    console.warn('🔴 FrontendConfig: goDaemon.getAppConfig not available');
                    setIsLoaded(true);
                }
            } catch (error) {
                console.error('🔴 FrontendConfig: Failed to load config:', error);
                setIsLoaded(true); // Still set as loaded to prevent infinite loading
            }
        };

        loadConfig();
    }, []);

    return { config, isLoaded };
};
