import { Gallery } from './components/Gallery'
import { useState, type FC } from 'react'
import { type ImagesArray, imagesObject} from './types/rendererTypes'
import './index.css'

const App: FC = () => {
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>(['worm.png','worm.png','worm.png','worm.png'])
  const [images] = useState<ImagesArray>([])

  const openFiles = (): void => {
    window.API_RENDERER.openFiles().then((imagesObject:imagesObject) => {
      setSkeletonsToShow(imagesObject.fileNames)
      window.API_RENDERER.handleOpenImages(imagesObject).then(()=>{
        console.log('we should reload!',Date.now())
      })
    })
    .catch(error => { console.error(error) })
  }

  return (
    <>
    <h1 className='text-center font-extrabold font-sans '>Hola mundo</h1>
    <button onClick={openFiles}>Add images</button>
    <Gallery filePathList={images} skeletonsToShow={skeletonsToShow}/>
    </>
  )
}

export default App
