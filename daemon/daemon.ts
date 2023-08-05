import { message, PlaylistType, appDirectories, ACTIONS } from './daemonTypes'
import { Sequelize } from 'sequelize'
import * as net from 'node:net'
import * as fs from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { homedir } from 'node:os'
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(homedir(), '.waypaper', 'imagesDB.sqlite3')
})
const IMAGES_DIR = join(homedir(), '.waypaper', 'images')
let playlistState = false
let currentImageIndex: number
const SOCKET_PATH = '/tmp/waypaper_daemon.sock'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function stopPlaylist() {
  playlistState = false
}
function startPlaylist() {
  playlistState = true
}
async function updatePlaylistInDB(imageIndex: number, playlistName: string) {
  try {
    await sequelize.authenticate()
    await sequelize.query(
      `UPDATE Playlist SET currentImageIndex = ${imageIndex} WHERE name = '${playlistName}'`
    )
  } catch (error) {
    console.error(error)
    throw new Error('Could not update playlist in DB')
  }
}
async function getPlaylistFromDB(playlistName: string) {
  try {
    await sequelize.authenticate()
    const [playlist] = await sequelize.query(
      `SELECT * FROM Playlist WHERE name = '${playlistName}'`
    )
    if (!playlist.length) throw new Error('Playlist not found')
    return playlist[0] as PlaylistType
  } catch (error) {
    console.error(error)
    throw new Error('Could not get playlist from DB')
  }
}
async function timedPlaylist(
  playlistName: string,
  swwwBin: string,
  swwwOptions: string[]
) {
  const playlist = await getPlaylistFromDB(playlistName)
  const interval =
    playlist.hours * 60 * 60 * 1000 + playlist.minutes * 60 * 1000
  currentImageIndex = playlist.currentImageIndex
  while (playlistState) {
    if (currentImageIndex === playlist.images.length) {
      currentImageIndex = 0
    }
    execSync(
      `${swwwBin} img ${swwwOptions.join(' ')} ${join(
        IMAGES_DIR,
        playlist.images[currentImageIndex]
      )}`
    )
    currentImageIndex++
    await updatePlaylistInDB(currentImageIndex, playlist.name)
    await sleep(interval)
  }
  console.log('Playlist stopped')
}

function daemonManager(data: Buffer) {
  const message: message = JSON.parse(data.toString())
  if (message.action === ACTIONS.START_PLAYLIST) {
    stopPlaylist()
    startPlaylist()
    timedPlaylist(
      message.payload.playlistName,
      message.payload.swwwBin,
      message.payload.swwwOptions
    )
  }
  if (message.action === ACTIONS.PAUSE_PLAYLIST) {
    stopPlaylist()
  }
  if (message.action === ACTIONS.NEXT_IMAGE) {
    currentImageIndex++
  }
  if (message.action === ACTIONS.PREVIOUS_IMAGE) {
    currentImageIndex--
  }
  if (message.action === ACTIONS.STOP_DAEMON) {
    sequelize.close()
    daemonServer.close()
  }
}

const daemonServer = net.createServer((socket) => {
  socket.on('data', daemonManager)
})

daemonServer.on('error', (err) => {
  if (err.message.includes('EADDRINUSE')) {
    fs.unlinkSync(SOCKET_PATH)
    daemonServer.listen(SOCKET_PATH, () => {
      console.log('Daemon started on socket', SOCKET_PATH)
      console.log('process id', process.pid)
    })
  } else {
    console.error(err)
  }
})

/* daemonServer.listen(SOCKET_PATH, () => {
  console.log('Daemon started on socket', SOCKET_PATH)
  console.log('process id', process.pid)
}) */
process.on('SIGTERM', function () {
  daemonServer.close(() => {
    console.log('Server closed')
  })
})
