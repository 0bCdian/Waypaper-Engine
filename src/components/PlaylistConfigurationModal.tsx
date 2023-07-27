import { useForm, SubmitHandler, set } from 'react-hook-form'
import { useRef, useEffect } from 'react'

type Inputs = {
  playlistType: string
  order: string
  hours: string
  minutes: string
  showTransition: boolean
}

interface PlaylistConfigurationModalProps {
  visible: boolean
}

const PlaylistConfigurationModal = ({
  visible
}: PlaylistConfigurationModalProps) => {
  const containerRef = useRef<HTMLDialogElement>(null)
  const { register, handleSubmit, watch, setValue } = useForm<Inputs>()
  const closeModal = () => {
    containerRef.current?.close()
  }
  const onSubmit: SubmitHandler<Inputs> = (data) => {
    console.log(data)
    closeModal()
  }
  const hours = parseInt(watch('hours'))
  const minutes = parseInt(watch('minutes'))
  useEffect(() => {
    if (minutes === 60) {
      setValue('hours', (hours + 1).toString())
      setValue('minutes', '0')
    }
    if (minutes === 0  && hours === 0){
      setValue('minutes', '1')
    }
  }, [hours, minutes])
  useEffect(() => {
    if (!visible) return
    if (containerRef.current) {
      containerRef.current?.showModal()
    }
  }, [visible])

  return (
    <dialog
      onCancel={(e) => {
        e.preventDefault()
      }}
      ref={containerRef}
      className=' bg-transparent backdrop:bg-black open:animate-pop-in open:backdrop:animate-fade-in backdrop:bg-opacity-20 backdrop:backdrop-blur-sm'
    >
      <div className='bg-[#303030] relative rounded-xl'>
        <h1 className=' p-3 text-3xl text-slate-100'>Playlist Settings</h1>
        <hr className=' border-stone-400 border-[1px]' />
        <div>
          <form
            className='flex flex-col gap-10 p-3 '
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className='flex justify-between'>
              <label
                htmlFor='playlistType'
                className='text-2xl text-stone-200 font-semibold'
              >
                Change Wallpaper
              </label>
              <div className='w-2/5'>
                <select
                  id='playlistType'
                  className=' form-select font-medium w-full text-ellipsis '
                  defaultValue={'timer'}
                  {...register('playlistType', { required: true })}
                >
                  <option value='timer'>On a timer</option>
                  <option value='never'>Never</option>
                </select>
                <div className='flex mt-10'>
                  <div className='flex flex-col w-1/2'>
                    <label
                      htmlFor='hours'
                      className=' text-xl  text-slate-200 font-medium'
                    >
                      Hours
                    </label>
                    <input
                      id='hours'
                      min='0'
                      defaultValue='1'
                      type='number'
                      {...register('hours', { required: true, min: 0 })}
                      className='form-input'
                    />
                  </div>
                  <div className='flex flex-col w-1/2'>
                    <label
                      htmlFor='minutes'
                      className='text-xl text-slate-200 font-medium'
                    >
                      Minutes
                    </label>
                    <input
                      id='minutes'
                      defaultValue='0'
                      min='0'
                      max='60'
                      type='number'
                      {...register('minutes', {
                        required: true
                      })}
                      className='form-input'
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className='flex justify-between'>
              <label
                htmlFor='order'
                className='text-2xl font-semibold text-stone-200'
              >
                Order
              </label>
              <select
                className=' form-select  w-2/5 text-ellipsis'
                {...register('order', { required: true })}
                defaultValue={'ordered'}
                id='order'
              >
                <option value='random'>Random</option>
                <option value='ordered'>Ordered</option>
              </select>
            </div>
            <div className='flex justify-between'>
              <label
                htmlFor='showTransition'
                className='text-2xl text-stone-200 font-medium'
              >
                Show Wallpaper Transition
              </label>
              <input
                type='checkbox'
                className='p-2 mr-[37.5%]'
                id='showTransition'
                defaultChecked={true}
                {...register('showTransition')}
              />
            </div>
            <button
              type='submit'
              className='bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded w-1/5 m-auto'
            >
              Save changes
            </button>
          </form>
        </div>
      </div>
    </dialog>
  )
}

export default PlaylistConfigurationModal
