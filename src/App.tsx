import Gallery from './components/Gallery'
import Modals from './components/Modals'
import { ImagesProvider } from './hooks/imagesStore'
import './index.css'

const App = () => {
  return (
    <div className='h-[100vh] relative overflow-hidden'>
      <ImagesProvider>
        <Gallery />
      </ImagesProvider>

    </div>
  )
}

export default App
