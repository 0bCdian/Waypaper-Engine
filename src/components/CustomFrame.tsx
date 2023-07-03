import { type FC } from 'react'

const CustomFrame: FC = () => {
  return (
    <nav className='p-1 sticky z-10 top-0 right-0 m-0 bg-[#151515] text-[1.2rem]'>
      <ul className='flex justify-start space-x-4 ml-1'>
        <li>file</li>
        <li>edit</li>
        <li>selection</li>
        <li>help</li>
        <li>about</li>
      </ul>
    </nav>
  )
}

export default CustomFrame
