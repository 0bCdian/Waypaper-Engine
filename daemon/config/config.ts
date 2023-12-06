import { join } from 'node:path'
import dbOperations from '../database/dbOperationsDaemon'
import { homedir } from 'node:os'

const configuration = {
  swww: {
    settings: dbOperations.readSwwwConfig(),
    update: () => {
      configuration.swww.settings = dbOperations.readSwwwConfig()
    }
  },
  app: {
    settings: dbOperations.readAppConfig(),
    update: () => {
      configuration.app.settings = dbOperations.readAppConfig()
    }
  },
  IMAGES_DIR: join(homedir(), '.waypaper_engine', 'images'),
  SOCKET_PATH: '/tmp/waypaper_engine_daemon.sock'
}
export default configuration
