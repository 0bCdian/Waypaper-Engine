import ReactDOM from 'react-dom/client'
import App from './App'
import IntroScreen from './components/IntroScreen'
import './index.css'
import './extra.css'
import { BrowserRouter } from 'react-router-dom'
const { readAppConfig } = window.API_RENDERER
readAppConfig().then((data) => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <>
      {data.introAnimation && !data.startMinimized ? <IntroScreen /> : undefined}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </>
  )
})
