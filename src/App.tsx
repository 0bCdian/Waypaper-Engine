import Gallery from './components/Gallery'
import Modals from './components/Modals'
import { ImagesProvider } from './hooks/imagesStore'
import NavBar from './components/NavBar'
import './index.css'

const App = () => {
  return (
    <div className='h-[100vh] relative overflow-hidden'>
      <ImagesProvider>
        <Gallery />
        <Modals />
      </ImagesProvider>
      <NavBar />
    </div>
  )
}

export default App
