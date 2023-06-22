import { Gallery } from './components/Gallery'
import { useState, type FC } from 'react'

const App: FC = () => {
  const [imagesToShow, setImagesToShow] = useState([''])

  const openFiles = async (): Promise<void> => {
    try {
      const files = await window.API_RENDERER.openFiles()
      setImagesToShow(files)
    } catch (error) {
      console.error(error)
    }
  }
  const openSingleFile = async (): Promise<void> => {
    const file = await window.API_RENDERER.openSingleFile()
    setImagesToShow(file)
  }
  return (
    <>
      <h1 className='text-center font-extrabold font-sans '>Hola mundo</h1>
      <Gallery filePathList={imagesToShow}/>
      <button className='bg-slate-700 p-4 m-4' onClick={openFiles}>Abrir carpeta </button>
      <button className="bg-slate-700 p-4 m-4" onClick={openSingleFile}>Abre un solo archivo</button>

    </>
  )
}

export default App
