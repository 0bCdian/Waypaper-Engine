import { Routes, Route } from 'react-router-dom'
import Home from './routes/Home'
import SwwwConfig from './routes/SwwwConfig'
import Drawer from './components/Drawer'
import NavBar from './components/NavBar'
import { ImagesProvider } from './hooks/imagesStore'

const App = () => {
  return (
    <>
      <Drawer>
        <ImagesProvider>
          <NavBar />
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/swwwConfig' element={<SwwwConfig />} />
          </Routes>
        </ImagesProvider>
      </Drawer>
    </>
  )
}

export default App
