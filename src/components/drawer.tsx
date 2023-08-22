import { type FC } from 'react'

type Props = {
  children: React.ReactNode
}

const Drawer: FC<Props> = ({ children }) => {
  return (
    <div className='drawer overflow-clip max-w-full select-none'>
      <input id='my-drawer' type='checkbox' className='drawer-toggle' />
      <div className='drawer-content'>{children}</div>
      <div className='drawer-side'>
        <label htmlFor='my-drawer' className='drawer-overlay'></label>
        <ul className='menu rounded-box p-4 text-2xl h-full bg-base-200 text-base-content'>
          <li>
            <a>Swww configuration</a>
          </li>
          <li>
            <a>Bezier picker</a>
          </li>
          <li>
            <a>Solid color as wallpaper</a>
          </li>
          <li>
            <a>Monitor Configuration</a>
          </li>
          <li>
            <a>Configuration</a>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Drawer
