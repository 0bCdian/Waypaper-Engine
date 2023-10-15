import { useState, useEffect, useMemo } from 'react'
import { DndContext, useDraggable } from '@dnd-kit/core'
import { createSnapModifier } from '@dnd-kit/modifiers'
import { parseResolution } from '../utils/utilities'
const { getMonitors } = window.API_RENDERER
type MonitorArray = Awaited<ReturnType<typeof getMonitors>>
const Monitors = () => {
  const [monitors, setMonitors] = useState<MonitorArray | undefined>(undefined)
  const [gridSize, setGridSize] = useState(30)
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'edp1'
  })
  const snapToGrid = useMemo(() => createSnapModifier(gridSize), [gridSize])
  useEffect(() => {
    getMonitors().then((currentMonitors) => {
      setMonitors(currentMonitors)
    })
  }, [])
  useEffect(() => {
    if (monitors) {
    }
  }, [monitors])
  return (
    <>
      {monitors && (
        <div className='grid h-[100vh] items-center  '>
          <DndContext>
            <img
              src='atom:///home/obsy/Pictures/tests/wallpapermisha.png'
              className='absolute top-25 scale-75'
            />
            <div ref={setNodeRef} className='flex gap-16 z-10 justify-center'>
              <div>
                <span className='relative'>
                  {monitors ? monitors[0].name : ''}
                </span>
                <div
                  {...listeners}
                  {...attributes}
                  className='w-[480px] h-[270px] overflow-hidden border'
                ></div>
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
