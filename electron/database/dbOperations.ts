import { PlaylistTypeDB, imageModel } from '../types/types'
import { playlist, ORDER_TYPES } from '../../src/types/rendererTypes'
import { Image, Playlist } from './models'
export async function storeImagesInDB(images: string[]) {
  const imagesToStore = images.map((image) => {
    const imageInstance = {
      imageName: image,
      isChecked: false
    }
    return imageInstance
  })
  await Image.bulkCreate(imagesToStore)
  const queriedImages = await Image.findAll({
    where: {
      imageName: images
    }
  })
  const imagesAdded: imageModel[] = queriedImages.map((image) => {
    const imageData = image.dataValues
    return imageData
  })
  return imagesAdded
}

export async function storePlaylistInDB(playlistObject: playlist) {
  let imagesInPlaylist = playlistObject.images.map((image) => image.imageName)
  imagesInPlaylist =
    playlistObject.configuration.order === ORDER_TYPES.ORDERED
      ? imagesInPlaylist
      : // @ts-ignore
        imagesInPlaylist.toSorted(() => 0.5 - Math.random())
  const playlistInstance = {
    name: playlistObject.name,
    images: JSON.stringify(imagesInPlaylist),
    type: playlistObject.configuration.playlistType,
    hours: playlistObject.configuration.hours,
    minutes: playlistObject.configuration.minutes,
    order: playlistObject.configuration.order,
    showTransition: playlistObject.configuration.showTransition,
    currenImageIndex: 0
  }
  try {
    const playlistInDB = await Playlist.findOne({
      where: {
        name: playlistObject.name
      }
    })
    if (playlistInDB !== null) {
      await Playlist.update(playlistInstance, {
        where: {
          name: playlistObject.name
        }
      })
      const queriedPlaylist = await Playlist.findOne({
        where: {
          name: playlistObject.name
        }
      })
      if (!queriedPlaylist) {
        throw new Error('Error saving playlist')
      }
      return queriedPlaylist?.dataValues as PlaylistTypeDB
    } else {
      await Playlist.create(playlistInstance)
      const queriedPlaylist = await Playlist.findOne({
        where: {
          name: playlistObject.name
        }
      })
      const playlistAdded: PlaylistTypeDB = queriedPlaylist?.dataValues
      if (!playlistAdded) {
        throw new Error('Error saving playlist')
      }
      return playlistAdded
    }
  } catch (error) {
    console.log('error', error)
    throw error
  }
}

export async function readImagesFromDB() {
  try {
    const imageInstancesArray = await Image.findAll()
    const imagesArray: imageModel[] = imageInstancesArray.map((image) => {
      const imageData = image.dataValues
      return imageData
    })
    return imagesArray
  } catch (error) {
    console.error(error)
  }
}

export async function readPlaylistsFromDB() {
  try {
    const playlistInstancesArray = await Playlist.findAll()
    const playlistsArray: PlaylistTypeDB[] = playlistInstancesArray.map(
      (playlist) => {
        const playlistData = playlist.dataValues
        return playlistData
      }
    )
    return playlistsArray
  } catch (error) {
    console.error(error)
    throw new Error('Error reading playlists from DB')
  }
}

export async function deletePlaylistFromDB(playlistName: string) {
  try {
    await Playlist.destroy({
      where: {
        name: playlistName
      }
    })
  } catch (error) {
    console.error(error)
    throw new Error('Error deleting playlist from DB')
  }
}

export async function deleteImageFromDB(imageID: number) {
  try {
    await Image.destroy({
      where: {
        id: imageID
      }
    })
  } catch (error) {
    console.error(error)
    throw new Error('Error deleting image from DB')
  }
}
