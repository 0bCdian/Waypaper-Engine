import { Gallery } from './components/Gallery'
import { type FC } from 'react'
import './index.css'


const App: FC = () => {
  return (
    <div className='h-[100vh] relative overflow-hidden'>
      <Gallery />
    </div>
  )
}

export default App
