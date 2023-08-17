import { Sequelize } from 'sequelize'
type SequelizeType = typeof Sequelize
const Sequelizes: SequelizeType = require('sequelize')
import { join } from 'node:path'
import { homedir } from 'node:os'

export const sequelize = new Sequelizes({
  dialect: 'sqlite',
  storage: join(join(homedir(), '.waypaper'), 'imagesDB.sqlite3')
})
