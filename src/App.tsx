import { Gallery } from './components/Gallery'
import { useState, type FC, useEffect } from 'react'
import { type ImagesArray, imagesObject } from './types/rendererTypes'
import './index.css'

/* import NavBar from './components/NavBar'
import CustomFrame from './components/CustomFrame' */

const App: FC = () => {
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [images, setImages] = useState<ImagesArray>([])
  const openFiles = (): void => {
    window.API_RENDERER.openFiles()
      .then((imagesObject: imagesObject) => {
        setSkeletonsToShow(imagesObject.fileNames)
        window.API_RENDERER.handleOpenImages(imagesObject).then(() => {
          window.API_RENDERER.queryImages().then((data) => {
            setImages(data)
            setSkeletonsToShow([])
          })
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  useEffect(() => {
    window.API_RENDERER.queryImages().then((data) => {
      setImages(data)
      setSkeletonsToShow([])
    })
  }, [])

  return (
    <div className='relative '>
      <Gallery
        filePathList={images}
        skeletonsToShow={skeletonsToShow}
        onClick={openFiles}
      />
    </div>
  )
}

export default App
