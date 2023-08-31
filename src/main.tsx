import ReactDOM from 'react-dom/client'
import App from './App'
import IntroScreen from './components/IntroScreen'
import './index.css'
import './extra.css'
import { BrowserRouter } from 'react-router-dom'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <>
    <IntroScreen />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </>
)
