import { useRef } from 'react'

function useThrottle(callback: (...args: any) => void, limit = 1000) {
  const lastRun = useRef(Date.now())
  return () => {
    if (Date.now() - lastRun.current >= limit) {
      callback()
      lastRun.current = Date.now()
    }
  }
}

export default useThrottle
