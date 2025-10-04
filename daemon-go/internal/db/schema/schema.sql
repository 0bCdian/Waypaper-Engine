-- daemon-go/internal/db/schema/schema.sql

CREATE TABLE Images (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    isChecked INTEGER NOT NULL DEFAULT 0,
    isSelected INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    format TEXT NOT NULL
);

CREATE TABLE Playlists (
    id INTEGER NOT NULL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    interval INTEGER,
    showAnimations INTEGER NOT NULL DEFAULT 1,
    alwaysStartOnFirstImage INTEGER NOT NULL DEFAULT 0,
    "order" TEXT,
    currentImageIndex INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE imagesInPlaylist (
    imageID INTEGER NOT NULL,
    playlistID INTEGER NOT NULL,
    indexInPlaylist INTEGER NOT NULL,
    time INTEGER,
    FOREIGN KEY (imageID) REFERENCES Images(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (playlistID) REFERENCES Playlists(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE swwwConfig (
    config TEXT NOT NULL
);

CREATE TABLE appConfig (
    config TEXT NOT NULL
);

CREATE TABLE activePlaylists (
    playlistID INTEGER NOT NULL,
    activeMonitor TEXT NOT NULL,
    activeMonitorName TEXT NOT NULL UNIQUE,
    FOREIGN KEY (playlistID) REFERENCES Playlists(id)
);

CREATE TABLE imageHistory (
    imageID INTEGER NOT NULL,
    monitor TEXT NOT NULL,
    time TEXT DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (imageID) REFERENCES Images(id) ON DELETE CASCADE
);

CREATE TABLE selectedMonitor (
    monitor TEXT NOT NULL
);
