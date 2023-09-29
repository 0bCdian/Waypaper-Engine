import { useState, useEffect } from 'react'
import { parseResolution } from '../utils/utilities'
const { getMonitors } = window.API_RENDERER
type MonitorArray = Awaited<ReturnType<typeof getMonitors>>
const Monitors = () => {
  const [monitors, setMonitors] = useState<MonitorArray | undefined>(undefined)
  useEffect(() => {
    getMonitors().then((currentMonitors) => {
      setMonitors(currentMonitors)
    })
  }, [])
  return (
    <>
      {monitors && (
        <div className='grid h-[100vh] items-center  '>
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
        </div>
      )}
    </>
  )
}

export default Monitors
