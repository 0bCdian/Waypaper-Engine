import { useEffect, useRef, useState } from 'react'
import { useForm, SubmitHandler, FieldValues } from 'react-hook-form'
import playlistStore from '../hooks/playlistStore'
import { PLAYLIST_TYPES } from '../types/rendererTypes'
import { Image } from '../types/rendererTypes'

const { savePlaylist } = window.API_RENDERER

type Props = {
  currentPlaylistName: string
  setShouldReload: React.Dispatch<React.SetStateAction<Boolean>>
}

const SavePlaylistModal = ({ currentPlaylistName, setShouldReload }: Props) => {
  const { setName, readPlaylist } = playlistStore()
  const [error, showError] = useState({ state: false, message: '' })
  const modalRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit, setValue } = useForm()
  const closeModal = () => {
    modalRef.current?.close()
  }
  const checkDuplicateTimes = (Images: Image[]) => {
    let duplicatesExist = false
    const maxImageIndex = Images.length
    // impossible value to get from the input time in miniplaylist card
    let lastTime = -1
    for (let current = 0; current < maxImageIndex; current++) {
      if (Images[current].time === lastTime) {
        duplicatesExist = true
      } else {
        lastTime = Images[current].time
      }
    }
    return duplicatesExist
  }
  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setName(data.playlistName)
    const playlist = readPlaylist()
    if (playlist.configuration.playlistType === PLAYLIST_TYPES.TIME_OF_DAY) {
      if (checkDuplicateTimes(playlist.images)) {
        showError({
          state: true,
          message:
            'There are duplicate times in images, check them before resubmitting.'
        })
        return
      } else {
        showError({ state: false, message: '' })
      }
    }
    savePlaylist(playlist)
    setShouldReload(true)
    closeModal()
  }
  useEffect(() => {
    setValue('playlistName', currentPlaylistName)
  }, [currentPlaylistName])
  return (
    <dialog id='savePlaylistModal' className='modal' ref={modalRef}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className='modal-box form-control rounded-xl'
      >
        <h2 className='font-bold text-4xl text-center py-3 '>Save Playlist</h2>
        <div className='divider'></div>
        <label htmlFor='playlistName' className='label text-lg text-warning'>
          Playlists with the same name will be overwritten.
        </label>

        <input
          type='text'
          {...register('playlistName', { required: true })}
          id='playlistName'
          required
          className='input input-md rounded-sm input-ghost mb-3 text-lg '
          placeholder='Playlist Name'
        />
        <div className='divider'></div>
        {error.state && (
          <label
            htmlFor='playlistName'
            className='label text-lg text-error italic'
          >
            {error.message}
          </label>
        )}
        <button type='submit' className='btn btn-primary rounded-lg'>
          Save
        </button>
      </form>
      <form method='dialog' className='modal-backdrop'>
        <button>close</button>
      </form>
    </dialog>
  )
}

export default SavePlaylistModal
