import { mainProcess } from './mainProcess'
import { daemonInit } from './daemon'

if (process.argv[1] === '--init-daemon' || process.argv[3] === '--init-daemon') {
  process.title = 'wp-daemon'
  daemonInit()
} else {
  mainProcess()
}
