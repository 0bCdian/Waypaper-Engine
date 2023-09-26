import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const execPomisified = promisify(exec)
const sharp = require('sharp')

type MonitorsType = {
  id: number
  name: string
  description: string
  make: string
  model: string
  serial: string
  width: number
  height: number
  refreshRate: number
  x: number
  y: number
  activeWorkspace: Workspace
  specialWorkspace: Workspace
  reserved: number[]
  scale: number
  transform: number
  focused: boolean
  dpmsStatus: boolean
  vrr: boolean
}

type Workspace = {
  id: number
  name: string
}

sharp('./dual_monitor_full_hd.jpg')
  .extract({ left: 0, top: 0, width: 1920, height: 1080 }) // Specify the dimensions of the first part
  .toFile('./first_part.jpg', (err: any) => {
    if (err) {
      console.error(err)
    } else {
      console.log('First part saved successfully')
    }
  })

sharp('./dual_monitor_full_hd.jpg')
  .resize({ width: 1920, height: 1080 }) // Adjust the dimensions as per your requirement
  .extract({ left: 1920, top: 0, width: 1920, height: 1080 }) // Specify the dimensions of the second part
  .toFile('./second_part.jpg', (err: any) => {
    if (err) {
      console.error(err)
    } else {
      console.log('Second part saved successfully')
    }
  })
