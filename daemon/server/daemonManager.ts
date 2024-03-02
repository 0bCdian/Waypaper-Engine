import { type Socket, type Server } from "net";
import { type message, ACTIONS } from "../types/daemonTypes";
import { type PlaylistClass } from "../playlist/playlist";
import { notify } from "../utils/notifications";
import config from "../config/config";

export async function daemonManager(
    data: Buffer,
    socket: Socket,
    playlistController: PlaylistClass,
    daemonServer: Server
) {
    const message: message = JSON.parse(data.toString());
    if (message.action === ACTIONS.STOP_DAEMON) {
        const stopMessage = playlistController.stop(false);
        notify(stopMessage.message);
        socket.write(JSON.stringify(stopMessage));
        daemonServer.close();
        process.exit(0);
    }
    switch (message.action) {
        case ACTIONS.UPDATE_CONFIG:
            config.app.update();
            config.swww.update();
            socket.write(JSON.stringify({ action: ACTIONS.UPDATE_CONFIG }));
            break;
        case ACTIONS.START_PLAYLIST:
            {
                const startMessage = playlistController.start();
                notify(`Starting ${playlistController.currentName}`);
                socket.write(JSON.stringify(startMessage));
            }
            break;
        case ACTIONS.RANDOM_IMAGE:
            {
                const setImageMessage =
                    await playlistController.setRandomImage();
                socket.write(setImageMessage);
            }
            break;
        case ACTIONS.GET_INFO:
            {
                const diagnostics =
                    await playlistController.getPlaylistDiagnostics();
                socket.write(JSON.stringify(diagnostics));
            }
            break;
    }
    if (playlistController.currentName !== "") {
        switch (message.action) {
            case ACTIONS.PAUSE_PLAYLIST:
                {
                    const pauseMessage = playlistController.pause();
                    notify(pauseMessage);
                    socket.write(pauseMessage);
                }
                break;
            case ACTIONS.RESUME_PLAYLIST:
                {
                    const resumeMessage = playlistController.resume();
                    notify(resumeMessage);
                    socket.write(resumeMessage);
                }
                break;
            case ACTIONS.STOP_PLAYLIST:
                {
                    const stopMessage = playlistController.stop(true);
                    notify(JSON.stringify(stopMessage));
                    socket.write(JSON.stringify(stopMessage));
                }
                break;
            case ACTIONS.UPDATE_PLAYLIST:
                playlistController.updatePlaylist();
                break;
            case ACTIONS.NEXT_IMAGE:
                {
                    const nextImageMessage =
                        await playlistController.nextImage();
                    socket.write(nextImageMessage);
                }
                break;
            case ACTIONS.PREVIOUS_IMAGE:
                {
                    const previousImageMessage =
                        await playlistController.previousImage();
                    socket.write(previousImageMessage);
                }
                break;
        }
    }
}

export type daemonManagerType = typeof daemonManager;
