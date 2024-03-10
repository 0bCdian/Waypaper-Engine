import { createRoot } from 'react-dom/client';
import App from './App';
import IntroScreen from './components/IntroScreen';
import './index.css';
const { readAppConfig } = window.API_RENDERER;
void readAppConfig().then(data => {
    const root = document.getElementById('root');
    if (root === null) return;
    createRoot(root).render(
        <>
            {data.introAnimation && !data.startMinimized ? (
                <IntroScreen />
            ) : undefined}
            <App />
        </>
    );
});
