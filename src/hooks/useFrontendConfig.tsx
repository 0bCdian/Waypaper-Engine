import { useEffect, useState } from 'react';
import { frontendConfig } from '../utils/frontendConfig';

export const useFrontendConfig = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const loadedConfig = await frontendConfig.loadConfig();
                setConfig(loadedConfig);
                setIsLoaded(true);
                console.log('🟢 FrontendConfig: Config loaded successfully');
            } catch (error) {
                console.error('🔴 FrontendConfig: Failed to load config:', error);
                setIsLoaded(true); // Still set as loaded to prevent infinite loading
            }
        };

        loadConfig();
    }, []);

    return { config, isLoaded };
};
