DROP INDEX IF EXISTS `imagesInPlaylist_time_unique`;--> statement-breakpoint
ALTER TABLE `imageHistory` RENAME TO `imageHistoryOld`;--> statement-breakpoint
CREATE TABLE `imageHistory` (
	`imageID` integer NOT NULL,
	`monitor` text NOT NULL,
  `time` text DEFAULT (strftime('%s','now')),
	FOREIGN KEY (`imageID`) REFERENCES `Images`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `imageHistory` (`imageID`, `monitor`, `time`)
SELECT `imageID`, `monitor`, `time` FROM `imageHistoryOld`;--> statement-breakpoint
DROP TABLE `imageHistoryOld`;--> statement-breakpoint
CREATE UNIQUE INDEX `activePlaylists_activeMonitorName_unique` ON `activePlaylists` (`activeMonitorName`);
