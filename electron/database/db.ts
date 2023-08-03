const Sequelize = require('sequelize')
import { appDirectories } from '../globals/globals'
import { Image, Playlist } from './models'
import { join } from 'node:path'

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: join(appDirectories.mainDir, 'imagesDB.sqlite3')
})

export async function testDB() {
  try {
    await sequelize.authenticate()
    await Image.sync()
    await Playlist.sync()
    console.log('Connection has been established successfully.')
  } catch (error) {
    throw new Error(`Unable to connect to the database: ${error}`)
  }
}
