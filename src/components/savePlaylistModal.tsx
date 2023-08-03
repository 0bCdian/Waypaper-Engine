import { useRef } from 'react'
import { useForm, SubmitHandler, FieldValues } from 'react-hook-form'
import { playlistStore } from '../hooks/useGlobalPlaylist'

const { savePlaylist } = window.API_RENDERER

const SavePlaylistModal = () => {
  const { setName, readPlaylist } = playlistStore()
  const modalRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit } = useForm()
  const closeModal = () => {
    modalRef.current?.close()
  }
  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setName(data.playlistName)
    const playlist = readPlaylist()
    savePlaylist(playlist)
    closeModal()
  }

  return (
    <dialog
      id='savePlaylistModal'
      className='modal'
      ref={modalRef}
      onCancel={(e) => {
        e.preventDefault()
      }}
    >
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
