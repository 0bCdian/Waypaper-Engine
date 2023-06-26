import { Gallery } from './components/Gallery'
import { useState, useEffect, type FC } from 'react'
import './index.css'

const App: FC = () => {
  const [skeletonsToShow, setSkeletonsToShow] = useState<string[]>([])
  const [imagesInCache, setImagesInCache] = useState<string[]>([])

  const openFiles = (): void => {
    window.API_RENDERER.addNewImages().then((files) => {
      setSkeletonsToShow(files)
    }).catch(error => { console.error(error) })
  }

  const getImagesFromCache = async (): Promise<string[]> => {
    const imagesInCache = await window.API_RENDERER.getImagesFromCache()
    return imagesInCache
  }

  useEffect(() => {
    getImagesFromCache().then(
      (imagesFromCache) => {
        setImagesInCache(imagesFromCache)
      }
    ).catch(error => { console.error(error) })
  }, [])

  return (
    <>
      <h1 className='text-center font-extrabold font-sans '>Hola mundo</h1>
      <Gallery filePathList={imagesInCache} skeletonsToShow={skeletonsToShow}/>
      <button className="bg-slate-700 p-4 m-4" onClick={openFiles}>Abre un solo archivo</button>
    </>
  )
}

export default App
