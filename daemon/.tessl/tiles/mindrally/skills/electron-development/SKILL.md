---
name: electron-development
description: Electron development guidelines for building cross-platform desktop applications with JavaScript/TypeScript
---

# Electron Development Guidelines

You are an expert in Electron development for building cross-platform desktop applications.

## Core Principles

- Follow security best practices for Electron apps
- Separate main and renderer process concerns
- Use IPC for process communication
- Implement proper window management

## Project Structure

```
src/
├── main/              # Main process code
│   ├── index.ts      # Entry point
│   ├── ipc/          # IPC handlers
│   └── utils/        # Utilities
├── renderer/          # Renderer process code
│   ├── components/   # UI components
│   ├── pages/        # Application pages
│   └── styles/       # Stylesheets
├── preload/          # Preload scripts
│   └── index.ts     # Expose APIs to renderer
└── shared/           # Shared types and utilities
```

## Security Best Practices

### Context Isolation
```javascript
// main.js
const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, 'preload.js')
  }
});
```

### Preload Scripts
```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (channel, data) => {
    const validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  onMessage: (channel, callback) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  }
});
```

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
```

## IPC Communication

### Main Process
```javascript
const { ipcMain } = require('electron');

ipcMain.handle('read-file', async (event, filePath) => {
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return content;
});

ipcMain.on('save-file', (event, { path, content }) => {
  fs.writeFileSync(path, content);
  event.reply('file-saved', { success: true });
});
```

### Renderer Process
```javascript
// Using exposed API from preload
const content = await window.electronAPI.readFile('/path/to/file');
```

## Window Management

```javascript
const { BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Handle window events
  win.on('closed', () => {
    // Cleanup
  });

  // Load content
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile('dist/index.html');
  }
}
```

## Auto Updates

```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.on('update-available', () => {
  // Notify user
});

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  autoUpdater.checkForUpdatesAndNotify();
});
```

## Native Modules

- Use electron-rebuild for native dependencies
- Consider node-addon-api for custom modules
- Test native modules on all platforms
- Handle architecture differences (x64, arm64)

## Performance

- Minimize main process blocking
- Use web workers for heavy computation
- Implement lazy loading
- Profile with DevTools

## Testing

- Use Spectron or Playwright for E2E tests
- Unit test main process logic
- Test IPC handlers
- Test on all target platforms

## Building and Distribution

- Use electron-builder for packaging
- Configure proper app signing
- Set up auto-update infrastructure
- Test installers on all platforms
