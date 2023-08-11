import Store, { Schema } from 'electron-store'

type Config = {
  killDaemonOnExit: boolean
  showNotifications: boolean
  startMinimized: boolean
  swwwAnimations: boolean
}

enum ConfigKeys {
  KillDaemonOnExit = 'killDaemonOnExit',
  ShowNotifications = 'showNotifications',
  StartMinimized = 'startMinimized',
  SwwwAnimations = 'swwwAnimations'
}

const schema: Schema<Config> = {
  killDaemonOnExit: { type: 'boolean', default: false },
  showNotifications: { type: 'boolean', default: true },
  startMinimized: { type: 'boolean', default: false },
  swwwAnimations: { type: 'boolean', default: true }
}

export const store = new Store<Config>({ schema })

export function setConfig(settings: Config): void {
  store.set(ConfigKeys.KillDaemonOnExit, settings.killDaemonOnExit)
  store.set(ConfigKeys.ShowNotifications, settings.showNotifications)
  store.set(ConfigKeys.StartMinimized, settings.startMinimized)
  store.set(ConfigKeys.SwwwAnimations, settings.swwwAnimations)
}

export function getConfig(): Config {
  return {
    killDaemonOnExit: store.get(ConfigKeys.KillDaemonOnExit),
    showNotifications: store.get(ConfigKeys.ShowNotifications),
    startMinimized: store.get(ConfigKeys.StartMinimized),
    swwwAnimations: store.get(ConfigKeys.SwwwAnimations)
  }
}
