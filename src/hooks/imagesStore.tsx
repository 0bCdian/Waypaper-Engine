import {
  useReducer,
  useCallback,
  useMemo,
  useContext,
  useRef,
  createContext,
  useEffect
} from 'react'
import { ImagesArray, STORE_ACTIONS } from '../types/rendererTypes'
const { queryImages } = window.API_RENDERER

type state = {
  imagesArray: ImagesArray
  skeletonsToShow: string[]
  searchFilter: string
}

type action =
  | { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: ImagesArray }
  | { type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW; payload: string[] }
  | { type: STORE_ACTIONS.SET_SEARCH_FILTER; payload: string }

function reducer(state: state, action: action) {
  switch (action.type) {
    case 'SET_IMAGES_ARRAY':
      return { ...state, imagesArray: action.payload }
    case 'SET_SKELETONS_TO_SHOW':
      return { ...state, skeletonsToShow: action.payload }
    case 'SET_SEARCH_FILTER':
      return { ...state, searchFilter: action.payload }
    default:
      return state
  }
}

function imagesSource() {
  const [{ imagesArray, skeletonsToShow, searchFilter }, dispatch] = useReducer(
    reducer,
    {
      imagesArray: [],
      skeletonsToShow: [],
      searchFilter: ''
    }
  )
  const originalImagesArrayRef = useRef<ImagesArray>([])
  useEffect(() => {
    queryImages().then((data: ImagesArray) => {
      dispatch({ type: STORE_ACTIONS.SET_IMAGES_ARRAY, payload: data })
      originalImagesArrayRef.current = structuredClone(data)
    })
  }, [])
  const setSearchFilter = useCallback((searchFilter: string) => {
    dispatch({
      type: STORE_ACTIONS.SET_SEARCH_FILTER,
      payload: searchFilter
    })
  }, [])
  const resetImageCheckboxes = useCallback(() => {
    originalImagesArrayRef.current.forEach((image) => {
      image.isChecked = false
    })
  }, [])
  const sortedImages = useMemo(() => {
    return originalImagesArrayRef.current.sort((a, b) => {
      return a.id > b.id ? -1 : 1
    })
  }, [imagesArray])

  const filteredImages = useMemo(() => {
    return sortedImages.filter((image) =>
      image.imageName
        .toLocaleLowerCase()
        .includes(searchFilter.toLocaleLowerCase())
    )
  }, [searchFilter])

  return {
    imagesArray,
    skeletonsToShow,
    setSearchFilter,
    filteredImages,
    resetImageCheckboxes
  }
}

const ImagesContext = createContext<
  ReturnType<typeof imagesSource> | undefined
>(undefined)

export function ImagesProvider({ children }: { children: React.ReactNode }) {
  return (
    <ImagesContext.Provider value={imagesSource()}>
      {children}
    </ImagesContext.Provider>
  )
}
export function useImages() {
  return useContext(ImagesContext)!
}
