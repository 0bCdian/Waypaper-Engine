ALTER TABLE `swwwConfig` RENAME TO `swwwConfigOld`;
--> statement-breakpoint
ALTER TABLE `appConfig` RENAME TO `appConfigOld`;
--> statement-breakpoint
CREATE TABLE `swwwConfig` (
  `config` text DEFAULT [object Object] NOT NULL
);
--> statement-breakpoint
CREATE TABLE `appConfig` (
  `config` text DEFAULT [object Object] NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imageHistory` (
	`imageID` integer NOT NULL,
	`monitor` text NOT NULL,
	FOREIGN KEY (`imageID`) REFERENCES `Images`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `activePlaylists` (
  `playlistID` integer NOT NULL,
  `monitor` text NOT NULL DEFAULT 'clone',
	FOREIGN KEY (`playlistID`) REFERENCES `Playlists`(`id`) 
);
--> statement-breakpoint
INSERT INTO appConfig (config)
SELECT json_object(
    'killDaemon', CASE WHEN killDaemon = 1 THEN 'true' ELSE 'false' END,
    'playlistStartOnFirstImage', CASE WHEN playlistStartOnFirstImage = 1 THEN 'true' ELSE 'false' END,
    'notifications', CASE WHEN notifications = 1 THEN 'true' ELSE 'false' END,
    'swwwAnimations', CASE WHEN swwwAnimations = 1 THEN 'true' ELSE 'false' END,
    'introAnimation', CASE WHEN introAnimation = 1 THEN 'true' ELSE 'false' END,
    'startMinimized', CASE WHEN startMinimized = 1 THEN 'true' ELSE 'false' END,
    'minimizeInsteadOfClose', CASE WHEN minimizeInsteadOfClose = 1 THEN 'true' ELSE 'false' END,
    'randomImageMonitor','clone'
)
FROM appConfigOld;
--> statement-breakpoint
DROP TABLE `appConfigOld`;
--> statement-breakpoint
INSERT INTO swwwConfig (config)
SELECT json_object(
    'resizeType', resizeType,
    'fillColor', fillColor,
    'filterType', filterType,
    'transitionType', transitionType,
    'transitionStep', transitionStep,
    'transitionDuration', transitionDuration,
    'transitionFPS', transitionFPS,
    'transitionAngle', transitionAngle,
    'transitionPositionType', transitionPositionType,
    'transitionPosition', transitionPosition,
    'transitionPositionIntX', transitionPositionIntX,
    'transitionPositionIntY', transitionPositionIntY,
    'transitionPositionFloatX', transitionPositionFloatX,
    'transitionPositionFloatY', transitionPositionFloatY,
    'invertY', CASE WHEN invertY = 1 THEN 'true' ELSE 'false' END,
    'transitionBezier', transitionBezier,
    'transitionWaveX', transitionWaveX,
    'transitionWaveY', transitionWaveY
)
FROM swwwConfigOld;
--> statement-breakpoint
DROP TABLE swwwConfigOld;
--> statement-breakpoint
DROP TABLE activePlaylist;
--> statement-breakpoint
ALTER TABLE Images ADD `isSelected` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `Images_name_unique` ON `Images` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Playlists_name_unique` ON `Playlists` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `imagesInPlaylist_time_unique` ON `imagesInPlaylist` (`time`);--> statement-breakpoint
CREATE TRIGGER delete_playlist_if_empty
AFTER DELETE ON imagesInPlaylist
BEGIN
    DELETE FROM Playlists
    WHERE id = OLD.playlistID
    AND NOT EXISTS (
        SELECT 1
        FROM imagesInPlaylist
        WHERE playlistID = OLD.playlistID
        LIMIT 1
    );
END;
