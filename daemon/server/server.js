"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_fs_1 = require("node:fs");
var node_net_1 = require("node:net");
var config_1 = __importDefault(require("../config/config"));
var daemonManager_1 = require("./daemonManager");
var SOCKET_PATH = config_1.default.SOCKET_PATH;
function setupServer(playlistInstance) {
    var daemonServer = (0, node_net_1.createServer)(function (socket) {
        socket.on('data', function (buffer) {
            (0, daemonManager_1.daemonManager)(buffer, socket, playlistInstance, daemonServer);
        });
        socket.on('error', function (err) {
            console.error('Socket error:', err.message);
        });
    });
    daemonServer.on('error', function (err) {
        if (err.message.includes('EADDRINUSE')) {
            (0, node_fs_1.unlinkSync)(SOCKET_PATH);
            daemonServer.listen(SOCKET_PATH);
        }
        else {
            console.error(err);
        }
    });
    daemonServer.listen(SOCKET_PATH);
    return daemonServer;
}
exports.default = setupServer;
