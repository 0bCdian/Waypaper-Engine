import { useEffect, useState } from 'react'
import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core'
import MonitorRectangle from '../components/MonitorRectangle'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import {
  restrictToFirstScrollableAncestor,
  restrictToHorizontalAxis
} from '@dnd-kit/modifiers'
// workaround to get animations while dragging elements, this is a limitation of react DND that has to have an id in the objects array to function properly.
interface MonitorRenderer {
  id: string
  name: string
  width: number
  height: number
  currentImage: string
  position: number
}
const { getMonitors, identifyMonitors, saveMonitorsInDB, getMonitorsFromDB } =
  window.API_RENDERER

const Monitors = () => {
  const [monitors, setMonitors] = useState<MonitorRenderer[]>([])
  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event
    if (!over) return
    if (over.id !== active.id) {
      const oldindex = monitors.findIndex((monitor) => monitor.id === active.id)
      const newIndex = monitors.findIndex((monitor) => monitor.id === over?.id)
      const newArrayOrder = arrayMove(monitors, oldindex, newIndex)
      setMonitors(newArrayOrder)
    }
  }
  const uniqueIdentifiers: string[] = []
  useEffect(() => {
    monitors.forEach((monitor) => {
      uniqueIdentifiers.push(monitor.name)
    })
  }, [monitors])
  useEffect(() => {
    Promise.all([getMonitors(), getMonitorsFromDB()]).then(
      ([monitors, monitorsFromDB]) => {
        let monitorsToSet: MonitorRenderer[] = []
        if (monitorsFromDB.length > 0) {
          monitorsFromDB.forEach((currentMonitorFromDB) => {
            const matchingMonitor = monitors.find(
              (current) => current.name === currentMonitorFromDB.name
            )
            monitorsToSet.push({
              id: currentMonitorFromDB.name,
              name: currentMonitorFromDB.name,
              width: matchingMonitor?.width || currentMonitorFromDB.width,
              height: matchingMonitor?.height || currentMonitorFromDB.height,
              currentImage:
                matchingMonitor?.currentImage ||
                currentMonitorFromDB.currentImage,
              position: currentMonitorFromDB.position
            })
          })
        } else {
          monitors.forEach((monitor) => {
            monitorsToSet.push({
              id: monitor.name,
              name: monitor.name,
              width: monitor.width,
              height: monitor.height,
              currentImage: monitor.currentImage,
              position: monitor.position
            })
          })
        }
        setMonitors(monitorsToSet)
      }
    )
  }, [])

  return (
    <div className='grid items-center w-[100vw] h-[100vh]'>
      <div className='m-auto flex flex-col align-middle justify-center w-full'>
        <div className='flex m-auto'>
          <DndContext
            modifiers={[
              restrictToHorizontalAxis,
              restrictToFirstScrollableAncestor
            ]}
            autoScroll={true}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              strategy={horizontalListSortingStrategy}
              items={monitors}
            >
              {monitors.map((monitor) => (
                <MonitorRectangle key={monitor.name} monitor={monitor} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <div className='flex self-center m-12 gap-5'>
          <button
            className='btn'
            onClick={() => {
              identifyMonitors()
            }}
          >
            Identify Monitors
          </button>
          <button
            className='btn'
            onClick={() => {
              monitors.forEach((monitor, index) => {
                monitor.position = index
              })
              saveMonitorsInDB(monitors)
            }}
          >
            Save monitors position
          </button>
        </div>
      </div>
    </div>
  )
}

export default Monitors
