import { useEffect } from 'react';
import { frontendConfig } from '../utils/frontendConfig';

export const useWindowBounds = () => {
    useEffect(() => {
        const saveWindowBounds = async () => {
            try {
                // Get current window bounds
                const { getCurrentWindow } = window.API_RENDERER.electron;
                const window = getCurrentWindow();
                const bounds = window.getBounds();
                
                // Save to frontend config
                await frontendConfig.setWindowBounds(bounds);
                console.log('🟢 WindowBounds: Saved window bounds:', bounds);
            } catch (error) {
                console.error('🔴 WindowBounds: Failed to save window bounds:', error);
            }
        };

        // Save bounds when component unmounts (window closes)
        const handleBeforeUnload = () => {
            saveWindowBounds();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);
};
