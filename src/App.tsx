import { Gallery } from './components/Gallery'
import { useState, type FC, useEffect } from 'react'
import { type ImagesArray } from './types/rendererTypes'
import './index.css'

/* import NavBar from './components/NavBar'
import CustomFrame from './components/CustomFrame' */

const App: FC = () => {
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [images, setImages] = useState<ImagesArray>([])

  useEffect(() => {
    window.API_RENDERER.queryImages().then((data) => {
      setImages(data)
      setSkeletonsToShow([])
    })
  }, [])

  return (
    <div className=''>
      <Gallery
        filePathList={images}
        skeletonsToShow={skeletonsToShow}
        setImages={setImages}
        setSkeletonsToShow={setSkeletonsToShow}
      />
    </div>
  )
}

export default App
