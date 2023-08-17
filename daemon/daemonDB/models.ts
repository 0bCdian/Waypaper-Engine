import { DataTypes } from 'sequelize'
import { sequelize } from './db'

const Image = sequelize.define(
  'Image',
  {
    imageID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    imageName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    isChecked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  },
  {
    tableName: 'Images',
    timestamps: false
  }
)

const Playlist = sequelize.define(
  'Playlist',
  {
    playlistID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    interval: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    order: {
      type: DataTypes.STRING,
      allowNull: true
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
    tableName: 'Playlist',
    timestamps: false
  }
)

const ImageInPlaylist = sequelize.define(
  'ImageInPlaylist',
  {
    playlistID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Playlist',
        key: 'playlistID'
      }
    },
    imageID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Images',
        key: 'imageID'
      }
    },
    index: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    beginTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    },
    endTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null
    }
  },
  {
    tableName: 'ImagesInPlaylist',
    timestamps: false
  }
)

Image.belongsToMany(Playlist, { through: ImageInPlaylist })
Playlist.belongsToMany(Image, { through: ImageInPlaylist })

export { Image, Playlist, ImageInPlaylist }
