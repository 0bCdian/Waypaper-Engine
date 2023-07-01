const Sequelize = require('sequelize')
import { appDirectories } from '../globals/globals'
import Image from './models'

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: appDirectories.mainDir + 'imagesDB.sqlite3'
})

export async function testDB() {
  try {
    await sequelize.authenticate()
    await Image.sync()
    console.log('Connection has been established successfully.')
  } catch (error) {
    throw new Error(`Unable to connect to the database: ${error}`)
  }
}
