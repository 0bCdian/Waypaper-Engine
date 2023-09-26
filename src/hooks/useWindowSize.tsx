import { useEffect, useState } from 'react'
import useThrottle from './useThrottle'
function useWindowSize() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  const setDimensionsThrottle = useThrottle(() => {
    const newDimensions = {
      width: window.innerWidth,
      height: window.innerHeight
    }
    setDimensions(newDimensions)
  })
  useEffect(() => {
    window.addEventListener('resize', setDimensionsThrottle)
    return window.removeEventListener('resize', setDimensionsThrottle)
  }, [dimensions])
  return dimensions
}

export default useWindowSize
