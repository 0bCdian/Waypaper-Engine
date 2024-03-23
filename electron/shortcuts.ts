import { type BrowserWindow, globalShortcut } from 'electron';
import { SHORTCUT_EVENTS } from '../shared/constants';

export function createShortcuts(win: BrowserWindow) {
    globalShortcut.register('Ctrl+A', () => {
        win.webContents.send(SHORTCUT_EVENTS.selectAllImagesInCurrentPage);
    });
    globalShortcut.register('Ctrl+Shift+A', () => {
        win.webContents.send(SHORTCUT_EVENTS.selectAllImagesInGallery);
    });
    globalShortcut.register('Esc', () => {
        win.webContents.send(SHORTCUT_EVENTS.clearSelection);
    });
}
