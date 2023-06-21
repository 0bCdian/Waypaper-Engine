import { ImageCard } from "./ImageCard"
import { FC } from "react"

interface GalleryProps {
  filePathList: string[]
}

export const Gallery: FC<GalleryProps> = ({ filePathList }) => {
  if (filePathList.length> 1){
    console.log('llegamos al return')
return (
    <>
      {filePathList.map((path) => {
        console.log('map')
        return   <ImageCard filePath={path} />
      })}
    </>
  )
  }
  else{
    return <h2>No hay imagenes cargadas aun</h2>
  }
  
}
