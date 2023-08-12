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
  useDebounce(() => setSearchFilter(inputSearch), 500, [inputSearch])

  return (
    <div className='my-3'>
      <input
        data-theme='retro'
        onChange={onTextChange}
        type='text'
        id='default-search'
        className='input input-bordered input-md placeholder:text-neutral rounded-xl transition-all text-md font-medium'
        placeholder='Search'
        required
      />
    </div>
  )
}

export default Filters
