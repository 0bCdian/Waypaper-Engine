import { FC } from 'react'

interface ImageProps {
  filePath: string
}

export const ImageCard: FC<ImageProps> = ({ filePath }) => {
  const correctFilepath = 'atom://' + filePath
  return <img className='block mx-auto h-24 rounded-full sm:mx-0 sm:shrink-0' src={correctFilepath} alt='image' />
}
