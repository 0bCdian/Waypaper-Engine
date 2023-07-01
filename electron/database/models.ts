import { Model, DataTypes } from 'sequelize'
import { sequelize } from './db'
class Image extends Model {}

Image.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    imageName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tags: {
      type: DataTypes.BLOB
    }
  },
  {
    sequelize,
    modelName: 'Images'
  }
)

export default Image
