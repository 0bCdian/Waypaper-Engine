import setupServer from './server/server'
import isWaypaperDaemonRunning from './utils/checkDependencies'
import { Playlist } from './playlist/playlist'
import { notify } from './utils/notifications'

if (isWaypaperDaemonRunning()) {
  process.exit(2)
}
process.title = 'wpe-daemon'
const playlist = new Playlist()
const server = setupServer(playlist)
process.on('SIGTERM', function () {
  notify('Exiting daemon')
  playlist.stop(false)
  server.close()
  process.exit(0)
})
process.on('SIGINT', () => {
  notify('Exiting daemon')
  playlist.stop(false)
  server.close()
  process.exit(0)
})
playlist.start()
