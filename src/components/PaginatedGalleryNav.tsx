import { type FC } from 'react'

interface PaginatedGalleryNavProps {
  currentPage: number
  totalPages: number
  setCurrentPage: (value: React.SetStateAction<number>) => void
}
const MAX_BUTTONS_PER_PAGE = 5
const PaginatedGalleryNav: FC<PaginatedGalleryNavProps> = ({
  currentPage,
  totalPages,
  setCurrentPage
}) => {
  const nextPage = () => {
    if (currentPage === totalPages) {
      setCurrentPage(0)
    }
    setCurrentPage((prevCurrentPage) => {
      return prevCurrentPage + 1
    })
  }
  const previousPage = () => {
    if (currentPage === 1) {
      setCurrentPage(totalPages + 1)
    }
    setCurrentPage((prevCurrentPage) => {
      return prevCurrentPage - 1
    })
  }
  if (totalPages <= 1) return <></>
  const buttonsPerPage =
    totalPages > MAX_BUTTONS_PER_PAGE ? MAX_BUTTONS_PER_PAGE : totalPages
  const currentButtonPage = Math.ceil(currentPage / buttonsPerPage)
  const lastButtonIndex =
    currentButtonPage * buttonsPerPage > totalPages
      ? totalPages
      : currentButtonPage * buttonsPerPage
  const firstButtonIndex = lastButtonIndex - buttonsPerPage
  const buttons: JSX.Element[] = []
  for (let i = firstButtonIndex + 1; i <= lastButtonIndex; i++) {
    buttons.push(
      <button
        key={i}
        className={`join-item font-bold btn-lg btn ${
          currentPage === i ? 'btn-active' : ''
        }`}
        onClick={() => setCurrentPage(i)}
      >
        {i}
      </button>
    )
  }
  return (
    <div className='join self-center mt-5 '>
      <button
        onClick={() => {
          setCurrentPage(1)
        }}
        className='join-item btn btn-neutral btn-lg rounded-lg'
      >
        First
      </button>
      <button
        onClick={previousPage}
        className='join-item btn-neutral btn-lg rounded-lg'
      >
        «
      </button>
      <div className=' md:[display:flex] [display:none]'>{buttons}</div>
      <button
        onClick={nextPage}
        className='join-item btn btn-lg btn-neutral rounded-lg'
      >
        »
      </button>
      <button
        onClick={() => {
          setCurrentPage(totalPages)
        }}
        className='join-item btn btn-lg btn-neutral rounded-lg'
      >
        Last
      </button>
    </div>
  )
}

export default PaginatedGalleryNav
