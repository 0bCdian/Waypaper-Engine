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
    isChecked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Images',
    timestamps: false
  }
)

export default Image
