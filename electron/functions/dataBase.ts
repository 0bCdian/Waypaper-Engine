const Sequelize = require('sequelize')

import { appDirectories } from '../globals/globals'

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: appDirectories.mainDir + 'imagesDB.sqlite3'
})

export async function testDB() {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
  }
}
