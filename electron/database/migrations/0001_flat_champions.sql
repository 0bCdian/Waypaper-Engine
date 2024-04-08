ALTER TABLE `swwwConfig` RENAME TO `swwwConfigOld`;
--> statement-breakpoint
ALTER TABLE `appConfig` RENAME TO `appConfigOld`;
--> statement-breakpoint
ALTER TABLE `imagesInPlaylist` RENAME TO `oldImagesInPlaylist`;--> statement-breakpoint
CREATE TABLE "imagesInPlaylist" (
	"imageID" INTEGER NOT NULL,
	"playlistID" INTEGER NOT NULL,
	"indexInPlaylist" INTEGER NOT NULL,
	"time" INTEGER DEFAULT null,
	FOREIGN KEY("imageID") REFERENCES "Images"("id") ON UPDATE CASCADE ON DELETE CASCADE,
	FOREIGN KEY("playlistID") REFERENCES "Playlists"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
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
  `monitor` text NOT NULL,
	FOREIGN KEY (`playlistID`) REFERENCES `Playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `selectedMonitor`(
  `monitor` text DEFAULT [object Object] NOT NULL
);
--> statement-breakpoint
INSERT INTO appConfig (config)
SELECT json_object(
    'killDaemon', CASE WHEN killDaemon = 1 THEN json('true') ELSE json('false') END,
    'playlistStartOnFirstImage', CASE WHEN playlistStartOnFirstImage = 1 THEN json('true') ELSE json('false') END,
    'notifications', CASE WHEN notifications = 1 THEN json('true') ELSE json('false') END,
    'swwwAnimations', CASE WHEN swwwAnimations = 1 THEN json('true') ELSE json('false') END,
    'introAnimation', CASE WHEN introAnimation = 1 THEN json('true') ELSE json('false') END,
    'startMinimized', CASE WHEN startMinimized = 1 THEN json('true') ELSE json('false') END,
    'minimizeInsteadOfClose', CASE WHEN minimizeInsteadOfClose = 1 THEN json('true') ELSE json('false') END,
    'randomImageMonitor','clone',
    'imagesPerPage',20
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
    'invertY', CASE WHEN invertY = 1 THEN json('true') ELSE json('false') END,
    'transitionBezier', transitionBezier,
    'transitionWaveX', transitionWaveX,
    'transitionWaveY', transitionWaveY
)
FROM swwwConfigOld;--> statement-breakpoint
DROP TABLE swwwConfigOld;--> statement-breakpoint
INSERT INTO imagesInPlaylist SELECT * FROM oldImagesInPlaylist;--> statement-breakpoint
DROP TABLE activePlaylist;--> statement-breakpoint
DROP TABLE oldImagesInPlaylist;--> statement-breakpoint
ALTER TABLE Images ADD `isSelected` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `Images_name_unique` ON `Images` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `Playlists_name_unique` ON `Playlists` (`name`);--> statement-breakpoint
CREATE TRIGGER keep_recent_images
AFTER INSERT ON imageHistory
BEGIN
    DELETE FROM imageHistory
    WHERE rowid IN (
        SELECT rowid
        FROM imageHistory
        ORDER BY rowid DESC
        LIMIT -1 OFFSET 10
    );
END;
