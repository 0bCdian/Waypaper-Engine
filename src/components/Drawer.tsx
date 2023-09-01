import { type FC, useState } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  children: React.ReactNode
}

const Drawer: FC<Props> = ({ children }) => {
  const [show, setShow] = useState(false)
  const toggle = () => {
    setShow((prev) => !prev)
  }
  return (
    <div className='drawer overflow-clip max-w-full select-none'>
      <input
        id='my-drawer'
        type='checkbox'
        className='drawer-toggle'
        checked={show}
        onChange={toggle}
      />
      <div className='drawer-content'>{children}</div>
      <div className='drawer-side z-10'>
        <label htmlFor='my-drawer' className='drawer-overlay'></label>
        <ul className='menu rounded-box p-4 text-2xl h-full bg-base-200 text-base-content'>
          <li>
            <Link onClick={toggle} to='/'>
              Gallery
            </Link>
            <Link onClick={toggle} to='/swwwConfig'>
              Swww configuration
            </Link>
            <Link onClick={toggle} to='/appConfig'>
              App configuration
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Drawer
