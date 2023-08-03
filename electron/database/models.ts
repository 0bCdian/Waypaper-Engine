import { Model, DataTypes } from 'sequelize'
import { sequelize } from './db'
class Image extends Model {}
class Playlist extends Model {}

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

Playlist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    images: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hours: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    minutes: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    order: {
      type: DataTypes.STRING,
      allowNull: false
    },
    showTransition: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    currentImageIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Playlist',
    timestamps: false
  }
)

export { Image, Playlist }
