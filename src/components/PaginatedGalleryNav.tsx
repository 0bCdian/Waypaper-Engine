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
      <div className='tooltip' data-tip={`Go To Page: ${i}`}>
        <button
          key={i}
          className={`join-item font-bold btn-lg btn ${
            currentPage === i ? 'btn-active' : ''
          }`}
          onClick={() => setCurrentPage(i)}
        >
          {i}
        </button>
      </div>
    )
  }
  return (
    <div className='join self-center mt-5 '>
      <div className='tooltip' data-tip='First Page'>
        <button
          onClick={() => {
            setCurrentPage(1)
          }}
          className='join-item btn btn-neutral btn-lg rounded-lg'
        >
          |«
        </button>
      </div>
      <div className='tooltip' data-tip='Previous Page'>
        <button
          onClick={previousPage}
          className='join-item btn-neutral btn-lg rounded-lg'
        >
          «««
        </button>
      </div>
      <div className=' md:[display:flex] [display:none]'>{buttons}</div>
      <div className='tooltip' data-tip='Next Page'>
        <button
          onClick={nextPage}
          className='join-item btn btn-lg btn-neutral rounded-lg'
        >
          »»»
        </button>
      </div>
      <div className='tooltip' data-tip='Last Page'>
        <button
          onClick={() => {
            setCurrentPage(totalPages)
          }}
          className='join-item btn btn-lg btn-neutral rounded-lg'
        >
          »|
        </button>
      </div>
    </div>
  )
}

export default PaginatedGalleryNav
