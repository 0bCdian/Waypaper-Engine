import { PlaylistTypeDB } from '../typesDaemon'
import { Playlist } from './models'

export async function readPlaylistFromDB(name: string) {
  try {
    const playlist = await Playlist.findOne({ where: { name } })
    if (!playlist) return null
    return playlist.dataValues as PlaylistTypeDB
  } catch (error) {
    console.error(error)
    throw new Error('Error reading playlists from DB')
  }
}

export async function updatePlaylistCurrentIndex(
  currentImageIndex: number,
  name: string
) {
  try {
    await Playlist.update(
      { currentImageIndex },
      {
        where: { name }
      }
    )
  } catch (error) {
    console.error(error)
    throw new Error('Error updating playlist current image index')
  }
}