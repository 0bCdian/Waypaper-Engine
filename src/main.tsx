import { createRoot } from 'react-dom/client'
import App from './App'
import IntroScreen from './components/IntroScreen'
import './index.css'
const { readAppConfig } = window.API_RENDERER
readAppConfig().then((data) => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <>
      {data.introAnimation && !data.startMinimized ? (
        <IntroScreen />
      ) : undefined}
      <App />
    </>
  )
})
