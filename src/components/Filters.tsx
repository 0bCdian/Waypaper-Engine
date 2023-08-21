import { ChangeEvent, useState } from 'react'
import useDebounce from '../hooks/useDebounce'
import { useImages } from '../hooks/imagesStore'
import IconBxSearchAlt from '../svg/search'

function Filters() {
  const { setSearchFilter } = useImages()
  const [inputSearch, setInputSearch] = useState('')
  const onTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target
    if (target !== null) {
      const text = target.value
      setInputSearch(text)
    }
  }
  useDebounce(() => setSearchFilter(inputSearch), 500, [inputSearch])

  return (
    <div className='sm:w-1/2 flex justify-end group'>
      <IconBxSearchAlt className='absolute right-2 top-4'></IconBxSearchAlt>
      <input
        onChange={onTextChange}
        type='text'
        id='default-search'
        className='transition-[width] duration-200 input input-info w-0 border-0
        group-hover:w-full focus:w-full
        rounded-xl text-xl font-medium'
        placeholder='Search image'
      />
    </div>
  )
}

export default Filters
