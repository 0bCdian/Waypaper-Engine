import { Routes, Route } from 'react-router-dom'
import Home from './routes/Home'
import SwwwConfig from './routes/SwwwConfig'
import Drawer from './components/Drawer'
import { ImagesProvider } from './hooks/imagesStore'
import AppConfig from './routes/AppConfiguration'
import { HashRouter } from 'react-router-dom'

const App = () => {
  return (
    <HashRouter>
      <Drawer>
        <ImagesProvider>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/swwwConfig' element={<SwwwConfig />} />
            <Route path='/appConfig' element={<AppConfig />} />
          </Routes>
        </ImagesProvider>
      </Drawer>
    </HashRouter>
  )
}

export default App
