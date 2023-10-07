import { ChangeEvent, useEffect, useState } from 'react'
import useDebounce from '../hooks/useDebounce'
import { useImages } from '../hooks/imagesStore'
import { Filters as FiltersType } from '../types/rendererTypes'

type PartialFilters = {
  order: 'asc' | 'desc'
  type: 'name' | 'id'
  searchString: string
}
const initialFilters: PartialFilters = {
  order: 'desc',
  type: 'id',
  searchString: ''
}

function Filters() {
  const { setFilters, filters } = useImages()
  const [partialFilters, setPartialFilters] = useState(initialFilters)

  const onTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target
    if (target !== null) {
      const text = target.value
      setPartialFilters((previous: PartialFilters) => {
        return { ...previous, searchString: text }
      })
    }
  }
  useDebounce(
    () => {
      const newFilters: FiltersType = {
        ...partialFilters,
        advancedFilters: filters.advancedFilters
      }
      setFilters(newFilters)
    },
    500,
    [partialFilters]
  )
  useEffect(() => {
    const resetFilters: FiltersType = {
      ...partialFilters,
      advancedFilters: filters.advancedFilters
    }
    setFilters(resetFilters)
  }, [])

  return (
    <div className='flex w-full gap-2 group justify-center mb-5'>
      <button
        className='btn btn-neutral-focus rounded-xl text-md'
        onClick={() => {
          //@ts-ignore
          window.AdvancedFiltersModal.showModal()
        }}
      >
        Filters
      </button>
      <div className='divider divider-horizontal mx-0' />
      <select
        name='orderBy'
        id='orderBy'
        className='select bg-[#0F0F0F] rounded-xl '
        defaultValue={'id'}
        onChange={(e) => {
          const newType = e.currentTarget.value as 'name' | 'id'
          if (newType) {
            setPartialFilters((previous) => {
              return { ...previous, type: newType }
            })
          }
        }}
      >
        <option value='name'>NAME</option>
        <option value='id'>DATE</option>
      </select>
      <label className='swap swap-rotate text-3xl '>
        <input
          type='checkbox'
          onChange={() => {
            setPartialFilters((previous) => {
              const newOrder = previous.order === 'asc' ? 'desc' : 'asc'
              return { ...previous, order: newOrder }
            })
          }}
        />
        <div className='swap-on'>🞁</div>
        <div className='swap-off'>🞃</div>
      </label>
      <div className='divider divider-horizontal mx-0'></div>
      <input
        onChange={onTextChange}
        type='text'
        id='default-search'
        className='input w-[20%] input-primary bg-neutral-focus  border-0 rounded-xl text-xl font-medium'
        placeholder='Search'
      />
    </div>
  )
}

export default Filters
