import { ipcRenderer } from 'electron'

export const ELECTRON_API = {
  openFiles: async () => {
    const files = await ipcRenderer.invoke('openFiles')
    return files
  },
  openSingleFile: async () => {
    const file = await ipcRenderer.invoke('openSingleFile')
    console.log(file)
    return file
  },
}
export type ELECTRON_API_TYPE = typeof ELECTRON_API
