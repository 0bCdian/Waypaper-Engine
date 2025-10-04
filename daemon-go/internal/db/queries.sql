-- Active Playlists Operations
-- name: GetActivePlaylists :many
SELECT p.id, p.name, p.type, p.interval, p.showAnimations, p.alwaysStartOnFirstImage, p."order", p.currentImageIndex,
       ap.activeMonitor, ap.activeMonitorName
FROM Playlists p
INNER JOIN activePlaylists ap ON p.id = ap.playlistID;

-- name: GetActivePlaylistByMonitor :one
SELECT p.id, p.name, p.type, p.interval, p.showAnimations, p.alwaysStartOnFirstImage, p."order", p.currentImageIndex,
       ap.activeMonitor, ap.activeMonitorName
FROM Playlists p
INNER JOIN activePlaylists ap ON p.id = ap.playlistID
WHERE ap.activeMonitorName = ?;

-- name: InsertActivePlaylist :exec
INSERT INTO activePlaylists (playlistID, activeMonitor, activeMonitorName)
VALUES (?, ?, ?);

-- name: RemoveActivePlaylist :exec
DELETE FROM activePlaylists
WHERE activeMonitorName = ?;

-- name: RemoveActivePlaylistByID :exec
DELETE FROM activePlaylists
WHERE playlistID = ?;

-- Playlist Operations
-- name: GetPlaylistByName :one
SELECT id, name, type, interval, showAnimations, alwaysStartOnFirstImage, "order", currentImageIndex
FROM Playlists
WHERE name = ?;

-- name: UpsertPlaylist :one
INSERT INTO Playlists (name, type, interval, showAnimations, alwaysStartOnFirstImage, "order", currentImageIndex)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(name) DO UPDATE SET
    type = excluded.type,
    interval = excluded.interval,
    showAnimations = excluded.showAnimations,
    alwaysStartOnFirstImage = excluded.alwaysStartOnFirstImage,
    "order" = excluded."order",
    currentImageIndex = excluded.currentImageIndex
RETURNING id;

-- name: DeletePlaylistByName :exec
DELETE FROM Playlists
WHERE name = ?;

-- name: UpdatePlaylistCurrentIndex :exec
UPDATE Playlists
SET currentImageIndex = ?
WHERE name = ?;

-- name: UpdatePlaylistCurrentIndexByID :exec
UPDATE Playlists
SET currentImageIndex = ?
WHERE id = ?;

-- Image Operations
-- name: GetAllImages :many
SELECT id, name, ischecked, isselected, width, height, format
FROM Images
ORDER BY id DESC;

-- name: GetImageByName :one
SELECT id, name, ischecked, isselected, width, height, format
FROM Images
WHERE name = ?;

-- name: InsertImages :many
INSERT INTO Images (name, ischecked, isselected, width, height, format)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING id, name, ischecked, isselected, width, height, format;

-- name: DeleteImagesByIDs :exec
DELETE FROM Images
WHERE id IN (sqlc.slice('imageIDs'));

-- name: UpdateImageSelection :exec
UPDATE Images
SET isselected = ?, ischecked = ?
WHERE id = ?;

-- Playlist Images Operations
-- name: GetPlaylistImagesOrdered :many
SELECT i.id, i.name, i.width, i.height, i.ischecked, i.isselected, i.format, ip.time
FROM imagesInPlaylist ip
INNER JOIN Images i ON ip.imageID = i.id
WHERE ip.playlistID = ?
ORDER BY ip.indexInPlaylist ASC;

-- name: GetPlaylistImagesRandom :many
SELECT i.id, i.name, i.width, i.height, i.isChecked, i.isSelected, i.format, ip.time
FROM imagesInPlaylist ip
INNER JOIN Images i ON ip.imageID = i.id
WHERE ip.playlistID = ?
ORDER BY RANDOM();

-- name: DeletePlaylistImages :exec
DELETE FROM imagesInPlaylist
WHERE playlistID = ?;

-- name: InsertPlaylistImage :exec
INSERT INTO imagesInPlaylist (imageID, playlistID, indexInPlaylist, time)
VALUES (?, ?, ?, ?);

-- Image History Operations
-- name: GetImageHistory :many
SELECT i.id, i.name, i.width, i.height, i.isChecked, i.isSelected, i.format, ih.monitor, ih.time
FROM imageHistory ih
INNER JOIN Images i ON ih.imageID = i.id
ORDER BY ih.time DESC
LIMIT ?;

-- name: AddImageToHistory :exec
INSERT INTO imageHistory (imageID, monitor, time)
VALUES (?, ?, strftime('%s', 'now'));

-- name: UpdateImageHistoryTime :exec
UPDATE imageHistory
SET time = strftime('%s', 'now')
WHERE imageID = ? AND monitor = ?;

-- name: CheckImageInHistory :one
SELECT COUNT(*) as count
FROM imageHistory
WHERE imageID = ? AND monitor = ?;

-- name: CleanupImageHistory :exec
DELETE FROM imageHistory
WHERE id NOT IN (
    SELECT id FROM imageHistory
    ORDER BY time DESC
    LIMIT ?
);

-- Random Image Operations
-- name: GetRandomImages :many
SELECT id, name, isChecked, isSelected, width, height, format
FROM Images
WHERE name NOT IN (sqlc.slice('excludeNames'))
ORDER BY RANDOM()
LIMIT ?;

-- name: GetRandomImagesAll :many
SELECT id, name, isChecked, isSelected, width, height, format
FROM Images
ORDER BY RANDOM()
LIMIT ?;

-- Configuration Operations
-- name: GetAppConfig :one
SELECT config FROM appConfig LIMIT 1;

-- name: UpsertAppConfig :exec
INSERT INTO appConfig (config)
VALUES (?)
ON CONFLICT DO UPDATE SET config = excluded.config;

-- name: DeleteAppConfig :exec
DELETE FROM appConfig;

-- name: GetSwwwConfig :one
SELECT config FROM swwwConfig LIMIT 1;

-- name: UpsertSwwwConfig :exec
INSERT INTO swwwConfig (config)
VALUES (?)
ON CONFLICT DO UPDATE SET config = excluded.config;

-- name: DeleteSwwwConfig :exec
DELETE FROM swwwConfig;

-- Selected Monitor Operations
-- name: GetSelectedMonitor :one
SELECT monitor FROM selectedMonitor LIMIT 1;

-- name: SetSelectedMonitor :exec
INSERT INTO selectedMonitor (monitor)
VALUES (?)
ON CONFLICT DO UPDATE SET monitor = excluded.monitor;

-- name: DeleteSelectedMonitor :exec
DELETE FROM selectedMonitor;

-- Additional Playlist Operations
-- name: GetAllPlaylists :many
SELECT id, name, type, interval, showAnimations, alwaysStartOnFirstImage, "order", currentImageIndex
FROM Playlists
ORDER BY name ASC;

-- name: GetPlaylistByID :one
SELECT id, name, type, interval, showAnimations, alwaysStartOnFirstImage, "order", currentImageIndex
FROM Playlists
WHERE id = ?;

-- name: DeletePlaylistByID :exec
DELETE FROM Playlists
WHERE id = ?;

-- Batch Image Operations
-- name: InsertImagesBatch :exec
INSERT INTO Images (name, isChecked, isSelected, width, height, format)
VALUES (?, ?, ?, ?, ?, ?);

-- name: UpdateImagesBatch :exec
UPDATE Images 
SET isSelected = ?, isChecked = ?
WHERE id IN (sqlc.slice('imageIDs'));

-- Enhanced Image History Operations
-- name: GetImageHistoryByMonitor :many
SELECT i.id, i.name, i.width, i.height, i.isChecked, i.isSelected, i.format, ih.monitor, ih.time
FROM imageHistory ih
INNER JOIN Images i ON ih.imageID = i.id
WHERE ih.monitor = ?
ORDER BY ih.time DESC
LIMIT ?;

-- name: GetImageHistoryCount :one
SELECT COUNT(*) as count
FROM imageHistory;

-- name: ClearImageHistory :exec
DELETE FROM imageHistory;

-- name: ClearImageHistoryByMonitor :exec
DELETE FROM imageHistory
WHERE monitor = ?;

-- name: GetImageHistoryPaginated :many
SELECT i.id, i.name, i.width, i.height, i.isChecked, i.isSelected, i.format, ih.monitor, ih.time
FROM imageHistory ih
INNER JOIN Images i ON ih.imageID = i.id
ORDER BY ih.time DESC
LIMIT ? OFFSET ?;

-- Enhanced Configuration Operations
-- name: GetConfigurationExists :one
SELECT COUNT(*) as count FROM appConfig;

-- name: GetSwwwConfigExists :one
SELECT COUNT(*) as count FROM swwwConfig;

-- name: BackupAppConfig :one
SELECT config FROM appConfig LIMIT 1;

-- name: BackupSwwwConfig :one
SELECT config FROM swwwConfig LIMIT 1;

-- Database Maintenance Operations
-- name: VacuumDatabase :exec
VACUUM;

-- name: AnalyzeDatabase :exec
ANALYZE;

-- name: GetDatabaseInfo :one
SELECT 
    (SELECT COUNT(*) FROM Images) as image_count,
    (SELECT COUNT(*) FROM Playlists) as playlist_count,
    (SELECT COUNT(*) FROM activePlaylists) as active_playlist_count,
    (SELECT COUNT(*) FROM imageHistory) as history_count;

-- Transaction Support Queries
-- name: BeginTransaction :exec
BEGIN TRANSACTION;

-- name: CommitTransaction :exec
COMMIT;

-- name: RollbackTransaction :exec
ROLLBACK;

-- Enhanced Playlist Image Operations
-- name: GetPlaylistImageCount :one
SELECT COUNT(*) as count
FROM imagesInPlaylist
WHERE playlistID = ?;

-- name: GetPlaylistImagesWithPagination :many
SELECT i.id, i.name, i.width, i.height, i.isChecked, i.isSelected, i.format, ip.time, ip.indexInPlaylist
FROM imagesInPlaylist ip
INNER JOIN Images i ON ip.imageID = i.id
WHERE ip.playlistID = ?
ORDER BY ip.indexInPlaylist ASC
LIMIT ? OFFSET ?;

-- name: UpdatePlaylistImageOrder :exec
UPDATE imagesInPlaylist
SET indexInPlaylist = ?
WHERE playlistID = ? AND imageID = ?;

-- name: GetMaxPlaylistImageIndex :one
SELECT COALESCE(MAX(indexInPlaylist), -1) as max_index
FROM imagesInPlaylist
WHERE playlistID = ?;

-- Bulk Operations for Performance
-- name: DeleteMultipleImages :exec
DELETE FROM Images
WHERE name IN (sqlc.slice('imageNames'));

-- name: InsertMultiplePlaylistImages :exec
INSERT INTO imagesInPlaylist (imageID, playlistID, indexInPlaylist, time)
VALUES (?, ?, ?, ?);

-- Advanced Search Operations
-- name: SearchImagesByName :many
SELECT id, name, isChecked, isSelected, width, height, format
FROM Images
WHERE name LIKE ?
ORDER BY name ASC
LIMIT ?;

-- name: GetImagesByFormat :many
SELECT id, name, isChecked, isSelected, width, height, format
FROM Images
WHERE format = ?
ORDER BY name ASC;

-- name: GetImagesByDimensions :many
SELECT id, name, isChecked, isSelected, width, height, format
FROM Images
WHERE width >= ? AND height >= ?
ORDER BY width DESC, height DESC;

-- Statistics and Analytics
-- name: GetImageFormatStats :many
SELECT format, COUNT(*) as count
FROM Images
GROUP BY format
ORDER BY count DESC;

-- name: GetPlaylistTypeStats :many
SELECT type, COUNT(*) as count
FROM Playlists
GROUP BY type
ORDER BY count DESC;

-- name: GetMostUsedImages :many
SELECT i.id, i.name, i.width, i.height, i.format, COUNT(ih.imageID) as usage_count
FROM Images i
LEFT JOIN imageHistory ih ON i.id = ih.imageID
GROUP BY i.id, i.name, i.width, i.height, i.format
ORDER BY usage_count DESC
LIMIT ?;

-- name: CreateImage :one
INSERT INTO Images (name, isChecked, isSelected, width, height, format)
VALUES (?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListImages :many
SELECT * FROM Images
ORDER BY name;

-- name: GetImage :one
SELECT * FROM Images
WHERE id = ?;
