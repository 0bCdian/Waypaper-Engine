import Sharp = require('sharp')
import { Image } from '../src/types/rendererTypes'
import config from './database/globalConfig'
import { appDirectories } from './globals/globals'
import { Monitor } from './types/types'
import { join } from 'node:path'
import { getMonitors } from './appFunctions'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
const execPomisified = promisify(exec)
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
    const { width, height } = monitors[current]
    const resizedImageFilePath = await resizeImageToFitMonitor(
      Sharp(imageFilePath, {
        animated: true,
        limitInputPixels: false
      }),
      Image,
      combinedMonitorWidth,
      height
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
          width: width,
          height: extractHeight
        })
        .toFile(finalImageName)
      monitorsToImagesPairsArray.push({
        monitor: monitors[current].name,
        image: finalImageName
      })
      lastWidth += width - 1
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
    const { width, height } = monitors[current]
    const resizedImageFilePath = await resizeImageToFitMonitor(
      Sharp(imageFilePath, {
        animated: true,
        limitInputPixels: false
      }),
      Image,
      width,
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
          height: height
        })
        .toFile(finalImageName)
      monitorsToImagesPairsArray.push({
        monitor: monitors[current].name,
        image: finalImageName
      })
      lastHeight += height - 1
    } catch (error) {
      console.log(error)
    }
  }
  return monitorsToImagesPairsArray
}

export async function createAndSetMonitorIdentifierImages() {
  const monitors = await getMonitors()
  monitors.forEach((monitor) => {
    const { width, height } = monitor
    const outputPath = join(appDirectories.tempImages, monitor.name + '.webp') // Output file path
    const textSize = Math.floor(width / 12)
    const svg = `<svg width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
    <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle" font-family="Arial" font-size="${textSize}" fill="#000000">${monitor.name}</text>
  </svg>`
    Sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{ input: Buffer.from(svg), gravity: 'center' }])
      .toFile(outputPath, (err, info) => {
        if (err) {
          console.error(err)
        } else {
          console.log('Image created:', info)
          try {
            execPomisified(`swww img -t none -o ${monitor.name} ${outputPath} `)
          } catch (error) {
            console.warn(error)
          }
          setTimeout(() => {
            execPomisified(
              `swww img -o ${monitor.name} -t none ${monitor.currentImage}`
            )
          }, 3000)
        }
      })
  })
}
