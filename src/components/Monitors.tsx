import { useState, useEffect } from 'react'
import { DndContext } from '@dnd-kit/core'
import { parseResolution } from '../utils/utilities'
const { getMonitors } = window.API_RENDERER
type MonitorArray = Awaited<ReturnType<typeof getMonitors>>
const Monitors = () => {
  const [monitors, setMonitors] = useState<MonitorArray | undefined>(undefined)
  const [gridSize, setGridSize] = useState(0)
  useEffect(() => {
    getMonitors().then((currentMonitors) => {
      setMonitors(currentMonitors)
    })
  }, [])
  useEffect(() => {
    if(monitors){
      
    }
  }, [monitors])
  return (
    <>
      {monitors && (
        <div className='grid h-[100vh] items-center  '>
          <DndContext>
            <div className='flex gap-16 justify-center'>
              <div>
                <span className='relative'>
                  {monitors ? monitors[0].name : ''}
                </span>
                <div className='w-[480px] h-[270px] overflow-hidden border'></div>
              </div>
              <div>
                <span className=''>{monitors ? monitors[1].name : ''}</span>
                <div className='w-[480px] h-[270px] border'></div>
              </div>
            </div>
          </DndContext>
        </div>
      )}
    </>
  )
}

export default Monitors
