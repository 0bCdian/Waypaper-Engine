import Gallery from './components/Gallery'
import Modals from './components/Modals'
import { ImagesProvider } from './hooks/imagesStore'
import NavBar from './components/NavBar'
import Drawer from './components/drawer'
import './index.css'

const App = () => {
  return (
    <>
      <Drawer>
        <ImagesProvider>
          <NavBar />
          <Gallery />
          <Modals />
        </ImagesProvider>
      </Drawer>
    </>
  )
}

export default App
