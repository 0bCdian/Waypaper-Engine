import { unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import config from '../config/config';
import { daemonManager } from './daemonManager';
import { type PlaylistClass } from '../playlist/playlist';

const { SOCKET_PATH } = config;

function setupServer(playlistInstance: PlaylistClass) {
    const daemonServer = createServer(socket => {
        socket.on('data', buffer => {
            void daemonManager(buffer, socket, playlistInstance, daemonServer);
        });
        socket.on('error', err => {
            console.error('Socket error:', err.message);
        });
    });

    daemonServer.on('error', err => {
        if (err.message.includes('EADDRINUSE')) {
            unlinkSync(SOCKET_PATH);
            daemonServer.listen(SOCKET_PATH);
        } else {
            console.error(err);
        }
    });

    daemonServer.listen(SOCKET_PATH);
    return daemonServer;
}
export default setupServer;
