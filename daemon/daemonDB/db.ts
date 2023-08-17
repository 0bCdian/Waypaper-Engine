const Database = require('better-sqlite3')
import { nativeBindingLocation, dbLocation } from '../binaries'

const db = Database(dbLocation, {
  nativeBinding: nativeBindingLocation,
  verbose: console.log
})
