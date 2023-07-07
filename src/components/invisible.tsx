import { type FC } from 'react'
import SvgComponent from './addImagesIcon'

const Invisible: FC = () => {
  return (
    <div className='opacity-0'>
      <div className=' flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-[#ebdbb2] '>
        Add images
      </p>
    </div>
  )
}
export default Invisible
