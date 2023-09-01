import {
  createInitialConfigIfNotExists,
  readAppConfig,
  readSwwwConfig,
  testDB
} from './dbOperations'

createInitialConfigIfNotExists()
testDB()
const config = {
  swww: {
    config: readSwwwConfig(),
    update: () => {
      config.swww.config = readSwwwConfig()
    }
  },
  app: {
    config: readAppConfig(),
    update: () => {
      config.app.config = readAppConfig()
    }
  }
}

export default config
