import { Link } from 'react-router-dom'
const { exitApp } = window.API_RENDERER
const NavBar = () => {
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
        <Link
          draggable={false}
          className='btn btn-ghost normal-case animate-none text-3xl'
          to='/'
        >
          Waypaper Engine
        </Link>
      </div>
      <div className='navbar-end'>
        <button
          className='btn btn-sm h-10 outline-none btn-error rounded-xl'
          onClick={() => {
            const quit = window.confirm('Are you sure you want to quit')
            if (quit) {
              exitApp()
            }
          }}
        >
          <svg
            width='16px'
            height='16px'
            viewBox='0 0 24 24'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            stroke='#CCC'
          >
            <g id='SVGRepo_bgCarrier' stroke-width='0'></g>
            <g
              id='SVGRepo_tracerCarrier'
              stroke-linecap='round'
              stroke-linejoin='round'
            ></g>
            <g id='SVGRepo_iconCarrier'>
              {' '}
              <path
                d='M20.7457 3.32851C20.3552 2.93798 19.722 2.93798 19.3315 3.32851L12.0371 10.6229L4.74275 3.32851C4.35223 2.93798 3.71906 2.93798 3.32854 3.32851C2.93801 3.71903 2.93801 4.3522 3.32854 4.74272L10.6229 12.0371L3.32856 19.3314C2.93803 19.722 2.93803 20.3551 3.32856 20.7457C3.71908 21.1362 4.35225 21.1362 4.74277 20.7457L12.0371 13.4513L19.3315 20.7457C19.722 21.1362 20.3552 21.1362 20.7457 20.7457C21.1362 20.3551 21.1362 19.722 20.7457 19.3315L13.4513 12.0371L20.7457 4.74272C21.1362 4.3522 21.1362 3.71903 20.7457 3.32851Z'
                fill='#CCC'
              ></path>{' '}
            </g>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default NavBar
