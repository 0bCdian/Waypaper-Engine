import { Sequelize } from 'sequelize'
type SequelizeType = typeof Sequelize
const Sequelizes: SequelizeType = require('sequelize')
import { appDirectories } from '../globals/globals'
import { join } from 'node:path'

export const sequelize = new Sequelizes({
  dialect: 'sqlite',
  storage: join(appDirectories.mainDir, 'imagesDB.sqlite3')
})
