import { ChangeEvent, useState, type FC, useEffect } from 'react'
import useDebounce from '../hooks/useDebounce'
interface FiltersProps {
  setSearchFilter: (value: React.SetStateAction<string>) => void
}

const Filters: FC<FiltersProps> = ({ setSearchFilter }) => {
  const [inputSearch, setInputSearch] = useState('')
  const onTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target
    if (target !== null) {
      const text = target.value
      setInputSearch(text)
    }
  }
  const debouncedSearch = useDebounce(inputSearch, 500)
  useEffect(() => {
    setSearchFilter(debouncedSearch)
  }, [debouncedSearch])

  return (
    <div className='p-3 w-[20%]'>        
    
      <input
        onChange={onTextChange}
        type='text'
        id='default-search'
        className='w-[75%] pl-10 h-12 px-4 text-sm text-gray-800 bg-gray-100 border border-gray-200 focus:ring-teal-700 rounded-full transition-all duration-300 xl: focus:w-[100%] focus:outline-none focus:ring-2 focus:ring-opacity-100'
        placeholder='Search'
        required
      />
    </div>
  )
}

export default Filters
