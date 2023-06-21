import { readdirSync } from 'node:fs'
import { dialog } from 'electron'
import { join } from 'node:path'

type fileList = string[] | undefined

export async function getImageFilenames() {
  const folder: fileList = dialog.showOpenDialogSync({
    properties: ['openDirectory'],
  }) ?? ['/']
  const path = folder[0]
  const filenames = readdirSync(path).map((file) => {
    return join(path, file)
  })
  return filenames
}
export async function getSingleImageFileName() {
  const file: fileList = dialog.showOpenDialogSync({
    properties: ['openFile','multiSelections'],
  }) ?? ['/']
  return file
}

