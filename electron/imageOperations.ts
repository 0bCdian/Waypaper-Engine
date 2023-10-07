import Sharp = require('sharp')
import { Image } from '../src/types/rendererTypes'
import config from './database/globalConfig'
import { appDirectories } from './globals/globals'
import { parseResolution } from '../src/utils/utilities'
import { Monitor } from './types/types'
import { join } from 'node:path'
export async function resizeImageToFitMonitor(
  buffer: Sharp.Sharp,
  Image: Image,
  requiredWidth: number,
  requiredHeight: number
) {
  const widthDifferenceImageToMonitors = requiredWidth - Image.width
  const heightDifferenceImageToCurrentMonitor = requiredHeight - Image.height
  const resizedImageFileName = `${appDirectories.tempImages}/resized.${Image.format}`
  if (
    widthDifferenceImageToMonitors < 0 ||
    heightDifferenceImageToCurrentMonitor < 0
  ) {
    await buffer
      .resize({
        width: requiredWidth,
        height: requiredHeight,
        fit: 'cover',
        background: hexToSharpRgb(config.swww.config.fillColor)
      })
      .toFile(resizedImageFileName)
  } else if (
    widthDifferenceImageToMonitors === 0 &&
    heightDifferenceImageToCurrentMonitor === 0
  ) {
    await buffer.toFile(resizedImageFileName)
  } else {
    await buffer
      .resize({
        width: requiredWidth,
        height: requiredHeight,
        fit: 'fill',
        background: hexToSharpRgb(config.swww.config.fillColor)
      })
      .toFile(resizedImageFileName)
  }
  return resizedImageFileName
}

function hexToSharpRgb(hex: string) {
  const parsedHex = hex.replace(/^#/, '').toLowerCase()
  const r = parseInt(parsedHex.slice(0, 2), 16)
  const g = parseInt(parsedHex.slice(2, 4), 16)
  const b = parseInt(parsedHex.slice(4, 6), 16)
  const rgbObject = {
    r: r,
    g: g,
    b: b,
    alpha: 1
  }
  return rgbObject
}

export async function splitImageVerticalAxis(
  monitors: Monitor[],
  Image: Image,
  imageFilePath: string,
  combinedMonitorWidth: number
) {
  const monitorsToImagesPairsArray: { monitor: string; image: string }[] = []
  let lastWidth: number = 0
  for (let current = 0; current < monitors.length; current++) {
    const finalImageName = join(
      appDirectories.tempImages,
      `${current}.${Image.format}`
    )
    const monitorResolution = parseResolution(monitors[current].resolution)
    const resizedImageFilePath = await resizeImageToFitMonitor(
      Sharp(imageFilePath, {
        animated: true,
        limitInputPixels: false
      }),
      Image,
      combinedMonitorWidth,
      monitorResolution.height
    )
    const buffer = Sharp(resizedImageFilePath, {
      animated: true,
      limitInputPixels: false
    })
    const metadata = await buffer.metadata()
    const extractHeight =
      metadata.format === 'gif' ? metadata.pageHeight : metadata.height
    if (!extractHeight)
      throw new Error(
        'Could not retrieve information from metadata something went wrong with the Sharp Buffer'
      )
    try {
      await buffer
        .extract({
          left: lastWidth,
          top: 0,
          width: monitorResolution.width,
          height: extractHeight
        })
        .toFile(finalImageName)
      monitorsToImagesPairsArray.push({
        monitor: monitors[current].name,
        image: finalImageName
      })
      lastWidth += monitorResolution.width - 1
    } catch (error) {
      console.log(error)
    }
  }
  return monitorsToImagesPairsArray
}

export async function splitImageHorizontalAxis(
  monitors: Monitor[],
  Image: Image,
  imageFilePath: string,
  combinedMonitorHeight: number
) {
  const monitorsToImagesPairsArray: { monitor: string; image: string }[] = []
  let lastHeight: number = 0

  for (let current = 0; current < monitors.length; current++) {
    const finalImageName = join(
      appDirectories.tempImages,
      `${current}.${Image.format}`
    )
    const monitorResolution = parseResolution(monitors[current].resolution)
    const resizedImageFilePath = await resizeImageToFitMonitor(
      Sharp(imageFilePath, {
        animated: true,
        limitInputPixels: false
      }),
      Image,
      monitorResolution.width,
      combinedMonitorHeight
    )
    const buffer = Sharp(resizedImageFilePath, {
      animated: true,
      limitInputPixels: false
    })
    const metadata = await buffer.metadata()
    if (!metadata.width)
      throw new Error(
        'Could not retrieve metadat.height something went wrong with the Sharp Buffer'
      )
    try {
      await buffer
        .extract({
          left: 0,
          top: lastHeight,
          width: metadata.width,
          height: monitorResolution.height
        })
        .toFile(finalImageName)
      monitorsToImagesPairsArray.push({
        monitor: monitors[current].name,
        image: finalImageName
      })
      lastHeight += monitorResolution.height - 1
    } catch (error) {
      console.log(error)
    }
  }
  return monitorsToImagesPairsArray
}
