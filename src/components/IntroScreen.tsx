import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

function IntroScreen() {

  const [showIntro, setShowIntro] = useState(true)
  useEffect(() => {
    setTimeout(() => {
      setShowIntro(false)
    }, 2600)
  }, [])

  return (
    <AnimatePresence>
      {showIntro && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{
            duration: '.5'
          }}
          className='relative z-50 bg-base-100 h-screen w-screen'
        >
          <motion.div className='inline-block text-center relative top-[40vh] left-[29vw]'>
            <p
              id='animateText'
              className='w-full top-56 left-56 text-8xl overflow-clip whitespace-nowrap text-center  tracking-wide font-medium py-2 pr-2 border-r-4 '
            >
              Waypaper Engine.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default IntroScreen
