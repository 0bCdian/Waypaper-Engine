import { useForm, SubmitHandler } from 'react-hook-form'
import { useRef, useEffect } from 'react'
import { playlistStore } from '../hooks/useGlobalPlaylist'
import { ORDER_TYPES } from '../types/rendererTypes'

type Inputs = {
  playlistType: string
  order: ORDER_TYPES
  hours: string
  minutes: string
  showTransition: boolean
}

const PlaylistConfigurationModal = () => {
  const { setConfiguration } = playlistStore()
  const { register, handleSubmit, watch, setValue } = useForm<Inputs>()
  const containerRef = useRef<HTMLDialogElement>(null)
  const closeModal = () => {
    containerRef.current?.close()
  }
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const parsedData = {
      ...data,
      hours: parseInt(data.hours),
      minutes: parseInt(data.minutes)
    }
    setConfiguration(parsedData)
    closeModal()
  }
  const hours = parseInt(watch('hours'))
  const minutes = parseInt(watch('minutes'))
  useEffect(() => {
    if (minutes === 60) {
      setValue('hours', (hours + 1).toString())
      setValue('minutes', '0')
    }
    if (minutes === 0 && hours === 0) {
      setValue('minutes', '1')
    }
  }, [hours, minutes])

  return (
    <dialog
      id='playlistConfigurationModal'
      ref={containerRef}
      className='modal '
      onCancel={(e) => {
        e.preventDefault()
      }}
    >
      <form
        className='modal-box form-control rounded-xl'
        onSubmit={handleSubmit(onSubmit)}
      >
        <h2 className='font-bold text-3xl text-center'>Playlist Settings</h2>
        <div className='divider'></div>
        <div className='flex justify-between items-baseline'>
          <label
            htmlFor='playlistType'
            className='label text-3xl font-semibold shrink'
          >
            Change wallpaper
          </label>
          <select
            id='playlistType'
            className='select select-info text-lg w-2/5 rounded-lg'
            defaultValue={'timer'}
            {...register('playlistType', { required: true })}
          >
            <option value='timer'>On a timer</option>
            <option value='never'>Never</option>
          </select>
        </div>
        <div className='flex justify-end items-baseline gap-1'>
          <div className='flex flex-col w-1/5 '>
            <label htmlFor='hours' className='label text-xl font-medium'>
              Hours
            </label>
            <input
              id='hours'
              min='0'
              defaultValue='1'
              type='number'
              {...register('hours', { required: true, min: 0 })}
              className='input input-info input-sm focus:outline-none text-lg font-medium rounded-lg'
            />
          </div>
          <div className='flex flex-col w-1/5'>
            <label
              className='label text-xl font-medium rounded-lg'
              htmlFor='minutes'
            >
              Minutes
            </label>
            <input
              id='minutes'
              defaultValue='0'
              min='0'
              max='60'
              type='number'
              step={1}
              {...register('minutes', {
                required: true
              })}
              className='input input-info input-sm  rounded-lg focus:outline-none text-lg font-medium'
            />
          </div>
        </div>
        <div className='divider'></div>
        <div className='flex justify-between items-baseline '>
          <label htmlFor='order' className='label text-3xl font-semibold'>
            Order
          </label>
          <select
            className='select select-info text-lg w-2/5 rounded-lg'
            {...register('order', { required: true })}
            defaultValue={ORDER_TYPES.ORDERED}
            id='order'
          >
            <option value={ORDER_TYPES.RANDOM}>Random</option>
            <option value={ORDER_TYPES.ORDERED}>Ordered</option>
          </select>
        </div>
        <div className='divider'></div>
        <div className='flex justify-between items-baseline'>
          <label
            htmlFor='showTransition'
            className='label text-2xl font-semibold'
          >
            Show transition
          </label>
          <input
            type='checkbox'
            className='toggle toggle-md toggle-success rounded-full'
            id='showTransition'
            defaultChecked={true}
            {...register('showTransition')}
          />
        </div>
        <div className='divider'></div>
        <div className='modal-action self-center'>
          <button type='submit' className='btn btn-info rounded-lg'>
            Save changes
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default PlaylistConfigurationModal
