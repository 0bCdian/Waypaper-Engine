import setupServer from './server/server'
import isWaypaperDaemonRunning from './utils/checkDependencies'
import { Playlist } from './playlist/playlist'
import { notify } from './utils/notifications'
import config from './config/config'

if (isWaypaperDaemonRunning()) {
  process.exit(2)
}
const scriptFlag = process.argv.find((arg) => {
  return arg.includes('--script')
})
if (scriptFlag) {
  const userScriptLocation = scriptFlag.split('=')[1]
  config.script = userScriptLocation
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
