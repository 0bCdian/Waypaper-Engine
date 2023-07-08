import { ChangeEvent, type FC } from 'react'

interface FiltersProps {
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void
}

/* const debounceFilterSearch = (
  callBack: (text: string) => void,
  delay = 100
) => {
  let timer: any
  return (text: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      callBack(text)
    }, delay)
  }
} */

const Filters: FC<FiltersProps> = ({ onSearch }) => {
  
  return (
    <div className='m-auto flex'>
      <div className='relative left-52 top-10'>
        <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
          <svg
            aria-hidden='true'
            className='w-5 h-5 text-stone-800 dark:text-gray-800'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              strokeLinejoin='round'
              strokeWidth='2'
              d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
            ></path>
          </svg>
        </div>
        <input
          onChange={onSearch}
          type='text'
          id='default-search'
          className='w-[30%] pl-10 h-12 px-4 text-sm text-gray-800 bg-gray-100 border border-gray-200 focus:ring-teal-700 rounded-full transition-all duration-300 xl: focus:w-[50%] focus:outline-none focus:ring-2 focus:ring-opacity-100'
          placeholder='Search'
          required
        />
      </div>
    </div>
  )
}

export default Filters
