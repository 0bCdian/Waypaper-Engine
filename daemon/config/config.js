"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_path_1 = require("node:path");
var dbOperationsDaemon_1 = __importDefault(require("../database/dbOperationsDaemon"));
var node_os_1 = require("node:os");
var configuration = {
    swww: {
        settings: dbOperationsDaemon_1.default.readSwwwConfig(),
        update: function () {
            configuration.swww.settings = dbOperationsDaemon_1.default.readSwwwConfig();
        }
    },
    app: {
        settings: dbOperationsDaemon_1.default.readAppConfig(),
        update: function () {
            configuration.app.settings = dbOperationsDaemon_1.default.readAppConfig();
        }
    },
    script: undefined,
    IMAGES_DIR: (0, node_path_1.join)((0, node_os_1.homedir)(), '.waypaper_engine', 'images'),
    SOCKET_PATH: '/tmp/waypaper_engine_daemon.sock'
};
exports.default = configuration;
