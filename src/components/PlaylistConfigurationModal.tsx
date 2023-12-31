import { useForm, SubmitHandler } from 'react-hook-form'
import { useRef, useEffect, useState } from 'react'
import playlistStore from '../hooks/playlistStore'
import { ORDER_TYPES, PLAYLIST_TYPES } from '../types/rendererTypes'
import { toMS, toHoursAndMinutes } from '../utils/utilities'
type Inputs = {
  playlistType: PLAYLIST_TYPES
  order: ORDER_TYPES | null
  hours: string | null
  minutes: string | null
  showTransition: boolean
}

const PlaylistConfigurationModal = () => {
  const [showError, setShowError] = useState(false)
  const { setConfiguration, readPlaylist } = playlistStore()
  const { register, handleSubmit, watch, setValue } = useForm<Inputs>()
  const containerRef = useRef<HTMLDialogElement>(null)
  const closeModal = () => {
    containerRef.current?.close()
  }
  const playlist = readPlaylist()
  const classNameDisabled =
    playlist.images.length > 7 ? 'bg-red-900 text-stone-100' : ''
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    switch (data.playlistType) {
      case PLAYLIST_TYPES.TIMER:
        if (data.hours && data.minutes) {
          const interval = toMS(parseInt(data.hours), parseInt(data.minutes))
          const configuration = {
            playlistType: data.playlistType,
            order: data.order,
            showAnimations: data.showTransition,
            interval: interval
          }
          setConfiguration(configuration)
        } else {
          console.error('Hours and minutes are required')
        }
        break
      case PLAYLIST_TYPES.TIME_OF_DAY:
        setConfiguration({
          playlistType: data.playlistType,
          order: null,
          showAnimations: data.showTransition,
          interval: null
        })
        break
      case PLAYLIST_TYPES.DAY_OF_WEEK:
        if (playlist.images.length > 7) {
          setShowError((prevState) => !prevState)
          setTimeout(() => {
            setShowError((prevState) => !prevState)
          }, 5000)
          return
        }
        setConfiguration({
          playlistType: data.playlistType,
          order: null,
          showAnimations: data.showTransition,
          interval: null
        })
        break
      case PLAYLIST_TYPES.NEVER:
        setConfiguration({
          playlistType: data.playlistType,
          order: data.order,
          showAnimations: data.showTransition,
          interval: null
        })
        break
      default:
        console.error('Invalid playlist type')
    }
    closeModal()
  }
  const hours = watch('hours')
  const minutes = watch('minutes')
  useEffect(() => {
    if (hours && minutes) {
      const parsedHours = parseInt(hours)
      const parsedMinutes = parseInt(minutes)
      if (parsedMinutes === 60) {
        setValue('hours', (parsedHours + 1).toString())
        setValue('minutes', '0')
      }
      if (parsedMinutes === 0 && parsedHours === 0) {
        setValue('minutes', '1')
      }
    }
  }, [hours, minutes])
  useEffect(() => {
    const interval = playlist.configuration.interval
    if (interval !== null) {
      const { hours, minutes } = toHoursAndMinutes(interval)
      setValue('hours', hours.toString())
      setValue('minutes', minutes.toString())
    }
    setValue('playlistType', playlist.configuration.playlistType)
    setValue('order', playlist.configuration.order)
    setValue('showTransition', Boolean(playlist.configuration.showAnimations))
  }, [playlist])
  return (
    <dialog
      id='playlistConfigurationModal'
      ref={containerRef}
      className='modal '
    >
      <form
        className='modal-box form-control rounded-xl'
        onSubmit={handleSubmit(onSubmit)}
      >
        <h2 className='font-bold text-3xl text-center'>Playlist Settings</h2>
        {showError && (
          <div className='alert alert-error mt-5'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='stroke-current shrink-0 h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            <span>Weekly playlists cannot have more than 7 images.</span>
          </div>
        )}
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
            className='select select-primary text-lg w-2/5 rounded-lg cursor-default'
            defaultValue={PLAYLIST_TYPES.TIMER}
            {...register('playlistType', { required: true })}
          >
            <option value={PLAYLIST_TYPES.TIMER}>On a timer</option>
            <option value={PLAYLIST_TYPES.TIME_OF_DAY}>Time of day</option>
            <option
              disabled={playlist.images.length > 7}
              className={classNameDisabled}
              value={PLAYLIST_TYPES.DAY_OF_WEEK}
            >
              Day of week
            </option>
            <option value={PLAYLIST_TYPES.NEVER}>Never</option>
          </select>
        </div>
        {watch('playlistType') === PLAYLIST_TYPES.TIMER && (
          <div className='flex justify-end items-baseline gap-1'>
            <div className='flex flex-col w-1/5 '>
              <label htmlFor='hours' className='label text-xl font-medium'>
                Hours
              </label>
              <input
                id='hours'
                min='0'
                defaultValue={1}
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
                defaultValue={0}
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
        )}
        {watch('playlistType') !== PLAYLIST_TYPES.TIME_OF_DAY &&
          watch('playlistType') !== PLAYLIST_TYPES.DAY_OF_WEEK && (
            <>
              <div className='divider'></div>
              <div className='flex justify-between items-baseline '>
                <label htmlFor='order' className='label text-3xl font-semibold'>
                  Order
                </label>
                <select
                  className='select select-primary text-lg w-2/5 rounded-lg cursor-default'
                  {...register('order', { required: true })}
                  defaultValue={ORDER_TYPES.ORDERED}
                  id='order'
                >
                  <option value={ORDER_TYPES.RANDOM}>Random</option>
                  <option value={ORDER_TYPES.ORDERED}>Ordered</option>
                </select>
              </div>
            </>
          )}
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
            className='toggle toggle-md toggle-success rounded-full cursor-default'
            id='showTransition'
            defaultChecked={true}
            {...register('showTransition')}
          />
        </div>
        <div className='divider'></div>
        <div className='modal-action self-center '>
          <button type='submit' className='btn btn-info rounded-lg'>
            Save changes
          </button>
        </div>
      </form>
      <form method='dialog' className='modal-backdrop'>
        <button>close</button>
      </form>
    </dialog>
  )
}

export default PlaylistConfigurationModal
