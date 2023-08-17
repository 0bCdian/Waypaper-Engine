import { useRef } from 'react'
import { Playlist } from '../../electron/types/types'
import playlistStore from '../hooks/playlistStore'
import { useForm, SubmitHandler } from 'react-hook-form'
import { Image } from '../types/rendererTypes'
import { useImages } from '../hooks/imagesStore'

type Input = {
  selectPlaylist: string
}
type Props = {
  shouldReload: React.MutableRefObject<boolean>
  playlistInDB: Playlist[]
}

const LoadPlaylistModal = ({ playlistInDB, shouldReload }: Props) => {
  const { clearPlaylist, setPlaylist } = playlistStore()
  const { resetImageCheckboxes, imagesArray } = useImages()
  const { register, handleSubmit } = useForm<Input>()
  const modalRef = useRef<HTMLDialogElement>(null)
  const closeModal = () => {
    modalRef.current?.close()
  }
  const onSubmit: SubmitHandler<Input> = (data) => {
    resetImageCheckboxes()
    clearPlaylist()
    const selectedPlaylist = playlistInDB.find((playlist) => {
      return playlist.name === data.selectPlaylist
    })
    if (selectedPlaylist) {
      const imagesFromDB = JSON.parse(selectedPlaylist.images) as string[]
      const imagesArrayFromPlaylist = imagesArray.filter((image: Image) => {
        return imagesFromDB.includes(image.imageName)
      }) as Image[]
      imagesArrayFromPlaylist.forEach((image) => {
        image.isChecked = true
      })
      const currentPlaylist = {
        name: selectedPlaylist.name,
        configuration: {
          playlistType: selectedPlaylist.type,
          hours: selectedPlaylist.hours,
          minutes: selectedPlaylist.minutes,
          order: selectedPlaylist.order,
          showTransition: selectedPlaylist.showTransition
        },
        images: imagesArrayFromPlaylist
      }
      setPlaylist(currentPlaylist)
      shouldReload.current = true
    }
    closeModal()
  }

  return (
    <dialog id='LoadPlaylistModal' className='modal' ref={modalRef}>
      <div className='modal-box container flex flex-col'>
        <h2 className='font-bold text-4xl text-center py-3 '>Load Playlist</h2>
        <div className='divider'></div>
        {playlistInDB.length === 0 && (
          <section className='flex flex-col gap-3'>
            <span className=' text-center font-medium text-xl italic'>
              No playlists found, refresh or create a new one
            </span>
            <button
              type='button'
              className='btn'
              onClick={() => {
                shouldReload.current = true
              }}
            >
              Refresh playlists
            </button>
          </section>
        )}
        {playlistInDB.length > 0 && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className='form-control flex flex-col gap-5'
          >
            <label htmlFor='selectPlaylist' className='label text-lg '>
              Select Playlist
            </label>
            <select
              id='selectPlaylist'
              className='select text-lg'
              {...register('selectPlaylist', { required: true })}
            >
              {playlistInDB.map((playlist) => (
                <option key={playlist.id} value={playlist.name}>
                  {playlist.name}
                </option>
              ))}
            </select>
            <div className='flex gap-3 justify-end mt-3'>
              <button
                type='button'
                className='btn btn-md btn-error rounded-md '
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type='button'
                className='btn btn-md btn-primary rounded-md '
                onClick={() => {
                  shouldReload.current = true
                }}
              >
                Refresh
              </button>
              <button
                type='submit'
                className='btn btn-success btn-md rounded-md '
              >
                Load
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}

export default LoadPlaylistModal
