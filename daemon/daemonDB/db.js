"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
var Sequelizes = require('sequelize');
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
exports.sequelize = new Sequelizes({
    dialect: 'sqlite',
    storage: (0, node_path_1.join)((0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper'), 'imagesDB.sqlite3')
});
