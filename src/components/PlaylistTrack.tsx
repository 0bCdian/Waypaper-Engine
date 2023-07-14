import { type FC, useState } from 'react'

interface miniImageProps {
  src: string
  id: number
}

const miniImage: FC<miniImageProps> = ({ src, id }) => {
  return (
    <div draggable key={id} className='w-max cursor-move'>
      <p></p>
      <img src={src} alt={src} className='w-[50px] h-[50px]' />
    </div>
  )
}

const PlayListTrack = () => {
  const [isHovered, setHover] = useState<boolean>(false)
  const [playlistItems, setPlaylistItems] = useState<string[]>([])

  return (
    <div
      className='bg-white absolute top-[95vh] text-stone-950 w-[100%] transition-all hover:p-8'
      onMouseOver={() => {
        setHover(true)
        console.log('setTrue')
      }}
      onMouseOut={() => {
        setHover(false)
        console.log('setFalse')
      }}
    >
      <div>box</div>
    </div>
  )
}

export default PlayListTrack
