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
    'killDaemon', killDaemon,
    'playlistStartOnFirstImage', playlistStartOnFirstImage,
    'notifications', notifications,
    'swwwAnimations', swwwAnimations,
    'introAnimation', introAnimation,
    'startMinimized', startMinimized,
    'minimizeInsteadOfClose', minimizeInsteadOfClose,
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
    'invertY', invertY,
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
CREATE UNIQUE INDEX `imagesInPlaylist_time_unique` ON `imagesInPlaylist` (`time`);

