import {
  useReducer,
  useCallback,
  useMemo,
  useContext,
  createContext,
  useEffect
} from 'react'
import { Image, STORE_ACTIONS } from '../types/rendererTypes'
const { queryImages } = window.API_RENDERER

type state = {
  imagesArray: Image[]
  skeletonsToShow: string[]
  searchFilter: string
}

type action =
  | { type: STORE_ACTIONS.SET_IMAGES_ARRAY; payload: Image[] }
  | { type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW; payload: string[] }
  | { type: STORE_ACTIONS.SET_SEARCH_FILTER; payload: string }
  | { type: STORE_ACTIONS.RESET_IMAGES_ARRAY; payload: Image[] }

function reducer(state: state, action: action) {
  switch (action.type) {
    case STORE_ACTIONS.SET_IMAGES_ARRAY:
      return {
        ...state,
        imagesArray: [...action.payload, ...state.imagesArray]
      }
    case STORE_ACTIONS.SET_SKELETONS_TO_SHOW:
      return { ...state, skeletonsToShow: action.payload }
    case STORE_ACTIONS.SET_SEARCH_FILTER:
      return { ...state, searchFilter: action.payload }
    case STORE_ACTIONS.RESET_IMAGES_ARRAY:
      return { ...state, imagesArray: action.payload }
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
  useEffect(() => {
    queryImages().then((data: Image[]) => {
      console.log(data)
      dispatch({ type: STORE_ACTIONS.SET_IMAGES_ARRAY, payload: data })
    })
  }, [])
  const setSearchFilter = useCallback((searchFilter: string) => {
    dispatch({
      type: STORE_ACTIONS.SET_SEARCH_FILTER,
      payload: searchFilter
    })
  }, [])
  const resetImageCheckboxes = useCallback(() => {
    const resetImagesArray = imagesArray.map((image) => {
      image.isChecked = false
      return image
    })
    dispatch({
      type: STORE_ACTIONS.RESET_IMAGES_ARRAY,
      payload: resetImagesArray
    })
  }, [imagesArray])
  const reQueryImages = useCallback(() => {
    queryImages().then((data: Image[]) => {
      dispatch({ type: STORE_ACTIONS.RESET_IMAGES_ARRAY, payload: data })
    })
  }, [])
  const removeImageFromStore = useCallback(
    (imageID: number) => {
      const newImagesArray = imagesArray.filter((image) => image.id !== imageID)
      dispatch({
        type: STORE_ACTIONS.RESET_IMAGES_ARRAY,
        payload: newImagesArray
      })
    },
    [imagesArray]
  )
  const clearSkeletons = useCallback(() => {
    dispatch({
      type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW,
      payload: []
    })
  }, [])
  const setSkeletons = useCallback((skeletons: string[]) => {
    dispatch({
      type: STORE_ACTIONS.SET_SKELETONS_TO_SHOW,
      payload: skeletons
    })
  }, [])
  const setImagesArray = useCallback((newImages: Image[]) => {
    dispatch({
      type: STORE_ACTIONS.SET_IMAGES_ARRAY,
      payload: newImages
    })
  }, [])
  const sortedImages = useMemo(() => {
    const shallowCopy = [...imagesArray]
    return shallowCopy.sort((a, b) => (a.id > b.id ? -1 : 1))
  }, [imagesArray])

  const filteredImages = useMemo(() => {
    const shallowCopy = [...sortedImages]
    return shallowCopy.filter((image) =>
      image.name.toLocaleLowerCase().includes(searchFilter.toLocaleLowerCase())
    )
  }, [searchFilter, sortedImages])
  const isEmpty = useMemo(
    () => !(imagesArray.length > 0 || skeletonsToShow.length > 0),
    [skeletonsToShow, imagesArray]
  )
  return {
    imagesArray,
    skeletonsToShow,
    filteredImages,
    isEmpty,
    setSearchFilter,
    setImagesArray,
    setSkeletons,
    resetImageCheckboxes,
    clearSkeletons,
    reQueryImages,
    removeImageFromStore
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
