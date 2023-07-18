import { type FC } from 'react'

interface MiniImageCardProps {
  imageName: string
}

 
const MiniImageCard: FC<MiniImageCardProps> = ({ imageName }) => {
  const imageSource =
    'atom://' + window.API_RENDERER.thumbnailDirectory + imageName + '.webp'
  return (
    <div>
      <img src={imageSource} alt='' />
    </div>
  )
}

const PlayListTrack = () => {
  return (
    <div className='bg-white absolute top-[95vh] text-stone-950 w-[100%] transition-all h-[15%]'>
      <MiniImageCard imageName='arch' />
    </div>
  )
}

export default PlayListTrack
