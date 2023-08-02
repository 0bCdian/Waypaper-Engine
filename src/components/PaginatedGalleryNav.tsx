import { type FC } from 'react'

interface PaginatedGalleryNavProps {
  currentPage: number
  totalPages: number
  setCurrentPage: (value: React.SetStateAction<number>) => void
}
const BUTTONS_PER_PAGE = 5
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
  const currentButtonPage = Math.ceil(currentPage / BUTTONS_PER_PAGE)
  const lastButtonIndex = currentButtonPage * BUTTONS_PER_PAGE
  const firstButtonIndex = lastButtonIndex - BUTTONS_PER_PAGE

  if (totalPages <= 1) return <></>
  const buttons: JSX.Element[] = []
  for (let i = firstButtonIndex + 1; i <= lastButtonIndex; i++) {
    buttons.push(
      <button
        key={i}
        className={`join-item btn btn-lg rounded-lg ${
          currentPage === i ? 'btn-active' : ''
        }`}
        onClick={() => setCurrentPage(i)}
      >
        {i}
      </button>
    )
  }
  return (
    <div className='join self-center my-3'>
      <button
        onClick={previousPage}
        className='join-item btn btn-neutral btn-lg rounded-lg'
      >
        «
      </button>
      <div className=' '>{buttons}</div>
      <button
        onClick={nextPage}
        className='join-item btn btn-lg btn-neutral rounded-lg'
      >
        »
      </button>
    </div>
  )
}

export default PaginatedGalleryNav
