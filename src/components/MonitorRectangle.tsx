import { FC } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Monitor {
  name: string
  width: number
  height: number
  currentImage: string
}

interface MonitorRectangleProps {
  monitor: Monitor
}

const MonitorRectangle: FC<MonitorRectangleProps> = ({ monitor }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: monitor.name
    })
  const image = 'atom://' + monitor.currentImage
  const aspectRatio = monitor.width / monitor.height
  const width = (1 / 6) * monitor.width // Adjust this as needed
  const height = width / aspectRatio
  const newStyle = {
    backgroundImage: `url(${image})`,
    backgroundSize: 'contain',
    backdropFilter: 'blur(100px)',
    width: width,
    height: height,
    backgroundPosition: 'center'
  }
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      className='flex flex-col'
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
    >
      <div className='m-auto flex flex-col w-[50%]'>
        <p className='text-center text-xl'>{monitor.name}</p>
        <p className='text-center text-xl'>
          {monitor.width}x{monitor.height}
        </p>
      </div>
      <div
        className='border-2 border-zinc-200 rounded-lg justify-center m-1'
        style={newStyle}
      ></div>
    </div>
  )
}

export default MonitorRectangle
