import { type FC } from 'react'
import Filters from './Filters'

const NavBar: FC = () => {
  return (
    <div className='navbar bg-base-100 mb-2'>
      <div className='navbar-start'>
        <div className='dropdown'>
          <label
            htmlFor='my-drawer'
            tabIndex={0}
            className='btn btn-ghost btn-circle'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-10 w-10'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='3'
                d='M4 6h16M4 12h16M4 18h7'
              />
            </svg>
          </label>
        </div>
      </div>
      <div className='navbar-center'>
        <a className='btn btn-ghost normal-case text-3xl'>Waypaper Engine</a>
      </div>
      <div className='navbar-end'>
        <Filters />
      </div>
    </div>
  )
}

export default NavBar
