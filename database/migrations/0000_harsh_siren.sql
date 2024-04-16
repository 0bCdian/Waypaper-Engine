-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations

CREATE TABLE IF NOT EXISTS `swwwConfig` (
	`resizeType` text NOT NULL,
	`fillColor` text NOT NULL,
	`filterType` text NOT NULL,
	`transitionType` text NOT NULL,
	`transitionStep` integer NOT NULL,
	`transitionDuration` integer NOT NULL,
	`transitionFPS` integer NOT NULL,
	`transitionAngle` integer NOT NULL,
	`transitionPositionType` text NOT NULL,
	`transitionPosition` text NOT NULL,
	`transitionPositionIntX` integer NOT NULL,
	`transitionPositionIntY` integer NOT NULL,
	`transitionPositionFloatX` real NOT NULL,
	`transitionPositionFloatY` real NOT NULL,
	`invertY` integer NOT NULL,
	`transitionBezier` text NOT NULL,
	`transitionWaveX` integer NOT NULL,
	`transitionWaveY` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `appConfig` (
	`killDaemon` integer NOT NULL,
	`playlistStartOnFirstImage` integer NOT NULL,
	`notifications` integer NOT NULL,
	`swwwAnimations` integer NOT NULL,
	`introAnimation` integer NOT NULL,
	`startMinimized` integer NOT NULL,
	`minimizeInsteadOfClose` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`isChecked` integer DEFAULT 0 NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Playlists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`interval` integer DEFAULT (null),
	`showAnimations` integer DEFAULT 1 NOT NULL,
	`order` text DEFAULT (null),
	`currentImageIndex` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `imagesInPlaylist` (
	`imageID` integer NOT NULL,
	`playlistID` integer NOT NULL,
	`indexInPlaylist` integer NOT NULL,
	`time` integer DEFAULT (null),
	FOREIGN KEY (`playlistID`) REFERENCES `Playlists`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`imageID`) REFERENCES `Images`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT  EXISTS `activePlaylist` (
	`playlistID` integer PRIMARY KEY
);

