import dbOperations from './dbOperationsDaemon'

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
  }
}
export default configuration
