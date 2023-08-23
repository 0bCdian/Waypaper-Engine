import Gallery from './components/Gallery'
import Modals from './components/Modals'
import { ImagesProvider } from './hooks/imagesStore'
import NavBar from './components/NavBar'
import Drawer from './components/drawer'
import IntroScreen from './components/IntroScreen'
import './index.css'
import './extra.css'

const App = () => {
  return (
    <>
      <IntroScreen></IntroScreen>
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
