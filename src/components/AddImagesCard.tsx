import { type FC } from 'react'
import SvgComponent from './addImagesIcon'

interface AddImagesCardProps {
  onClick: () => void
  alone: boolean
}

export const AddImagesCard: FC<AddImagesCardProps> = ({ onClick, alone }) => {
  const styles = alone
    ? 'relative rounded-lg max-w-fit mb-4 hover:bg-[#323232] active:scale-95 transition-all ease-in-out '
    : 'relative rounded-lg bg-[#323232] hover:bg-[#424242] active:scale-95 transition-all max-w-fit mb-4'
  return (
    <div className={styles} onClick={onClick}>
      <div className=' flex justify-center  rounded-lg min-w-[300px] min-h-[200px]'>
        <SvgComponent />
      </div>
      <p className='absolute top-[65%] left-[35%] font-bold text-stone-400 '>
        Add images
      </p>
    </div>
  )
}
