"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageInPlaylist = exports.Playlist = exports.Image = void 0;
var sequelize_1 = require("sequelize");
var db_1 = require("./db");
var Image = db_1.sequelize.define('Image', {
    imageID: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    imageName: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    isChecked: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
}, {
    tableName: 'Images',
    timestamps: false
});
exports.Image = Image;
var Playlist = db_1.sequelize.define('Playlist', {
    playlistID: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    interval: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true
    },
    order: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    showTransition: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false
    },
    currentImageIndex: {
        type: sequelize_1.DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
}, {
    tableName: 'Playlist',
    timestamps: false
});
exports.Playlist = Playlist;
var ImageInPlaylist = db_1.sequelize.define('ImageInPlaylist', {
    playlistID: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Playlist',
            key: 'playlistID'
        }
    },
    imageID: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Images',
            key: 'imageID'
        }
    },
    index: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    beginTime: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    endTime: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    }
}, {
    tableName: 'ImagesInPlaylist',
    timestamps: false
});
exports.ImageInPlaylist = ImageInPlaylist;
Image.belongsToMany(Playlist, { through: ImageInPlaylist });
Playlist.belongsToMany(Image, { through: ImageInPlaylist });
