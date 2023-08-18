import { ChangeEvent, useState } from 'react'
import useDebounce from '../hooks/useDebounce'
import { useImages } from '../hooks/imagesStore'

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
    <div className='container w-[100%] md:w-[10%] hover:'>
      <input
        data-theme='retro'
        onChange={onTextChange}
        type='text'
        id='default-search'
        className='input w-[100%] input-bordered input-md placeholder:text-neutral rounded-xl transition-all text-md font-medium'
        placeholder='Search'
        required
      />
    </div>
  )
}

export default Filters
