import { useEffect, useRef } from 'react'
import { useForm, SubmitHandler, FieldValues } from 'react-hook-form'
import playlistStore from '../hooks/playlistStore'

const { savePlaylist } = window.API_RENDERER

type Props = {
  currentPlaylistName: string
  shouldReload: React.MutableRefObject<boolean>
}

const SavePlaylistModal = ({ currentPlaylistName, shouldReload }: Props) => {
  const { setName, readPlaylist } = playlistStore()
  const modalRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit, setValue } = useForm()
  const closeModal = () => {
    modalRef.current?.close()
  }
  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setName(data.playlistName)
    const playlist = readPlaylist()
    savePlaylist(playlist)
    closeModal()
    shouldReload.current = true
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

        <button type='submit' className='btn btn-primary rounded-lg'>
          Save
        </button>
      </form>
    </dialog>
  )
}

export default SavePlaylistModal
