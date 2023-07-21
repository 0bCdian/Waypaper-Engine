import { Gallery } from './components/Gallery'
import { type FC } from 'react'
import './index.css'

const App: FC = () => {
  console.log('rendered app')
  return (
    <div className=''>
      <Gallery />
    </div>
  )
}

export default App
