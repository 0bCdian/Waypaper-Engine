import { Routes, Route } from 'react-router-dom'
import Home from './routes/Home'
import Monitors from './routes/Monitors'
import SwwwConfig from './routes/SwwwConfig'
import AppConfig from './routes/AppConfiguration'
import Drawer from './components/Drawer'
import { ImagesProvider } from './hooks/imagesStore'
import { HashRouter } from 'react-router-dom'
import NavBar from './components/NavBar'

const App = () => {
  return (
    <HashRouter>
      <Drawer>
        <NavBar />
        <ImagesProvider>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/swwwConfig' element={<SwwwConfig />} />
            <Route path='/appConfig' element={<AppConfig />} />
            <Route path='/monitors' element={<Monitors />} />
          </Routes>
        </ImagesProvider>
      </Drawer>
    </HashRouter>
  )
}

export default App
