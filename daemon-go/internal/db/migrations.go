package db

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"strconv"
)

// Migration represents a database migration
type Migration struct {
	Version     int
	Description string
	Up          string
	Down        string
}

// MigrationManager handles database migrations
type MigrationManager struct {
	db         *sql.DB
	migrations []Migration
}

// NewMigrationManager creates a new migration manager
func NewMigrationManager(db *sql.DB) *MigrationManager {
	return &MigrationManager{
		db:         db,
		migrations: getBuiltInMigrations(),
	}
}

// InitMigrationTable creates the migration tracking table if it doesn't exist
func (m *MigrationManager) InitMigrationTable(ctx context.Context) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			description TEXT NOT NULL,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			checksum TEXT NOT NULL
		);
	`
	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create migration table: %w", err)
	}
	return nil
}

// GetAppliedMigrations returns a list of applied migration versions
func (m *MigrationManager) GetAppliedMigrations(ctx context.Context) ([]int, error) {
	query := "SELECT version FROM schema_migrations ORDER BY version"
	rows, err := m.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer rows.Close()

	var versions []int
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("failed to scan migration version: %w", err)
		}
		versions = append(versions, version)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating migration rows: %w", err)
	}

	return versions, nil
}

// GetPendingMigrations returns migrations that haven't been applied yet
func (m *MigrationManager) GetPendingMigrations(ctx context.Context) ([]Migration, error) {
	applied, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		return nil, err
	}

	appliedMap := make(map[int]bool)
	for _, version := range applied {
		appliedMap[version] = true
	}

	var pending []Migration
	for _, migration := range m.migrations {
		if !appliedMap[migration.Version] {
			pending = append(pending, migration)
		}
	}

	// Sort by version
	sort.Slice(pending, func(i, j int) bool {
		return pending[i].Version < pending[j].Version
	})

	return pending, nil
}

// ApplyMigration applies a single migration
func (m *MigrationManager) ApplyMigration(ctx context.Context, migration Migration) error {
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute the migration
	if _, err := tx.ExecContext(ctx, migration.Up); err != nil {
		return fmt.Errorf("failed to execute migration %d: %w", migration.Version, err)
	}

	// Record the migration
	checksum := generateChecksum(migration.Up)
	_, err = tx.ExecContext(ctx,
		"INSERT INTO schema_migrations (version, description, checksum) VALUES (?, ?, ?)",
		migration.Version, migration.Description, checksum)
	if err != nil {
		return fmt.Errorf("failed to record migration %d: %w", migration.Version, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %d: %w", migration.Version, err)
	}

	return nil
}

// ApplyPendingMigrations applies all pending migrations
func (m *MigrationManager) ApplyPendingMigrations(ctx context.Context) error {
	pending, err := m.GetPendingMigrations(ctx)
	if err != nil {
		return err
	}

	if len(pending) == 0 {
		return nil
	}

	for _, migration := range pending {
		if err := m.ApplyMigration(ctx, migration); err != nil {
			return fmt.Errorf("failed to apply migration %d: %w", migration.Version, err)
		}
	}

	return nil
}

// RollbackMigration rolls back a single migration
func (m *MigrationManager) RollbackMigration(ctx context.Context, version int) error {
	// Find the migration
	var migration *Migration
	for _, m := range m.migrations {
		if m.Version == version {
			migration = &m
			break
		}
	}

	if migration == nil {
		return fmt.Errorf("migration %d not found", version)
	}

	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Execute the rollback
	if migration.Down != "" {
		if _, err := tx.ExecContext(ctx, migration.Down); err != nil {
			return fmt.Errorf("failed to rollback migration %d: %w", version, err)
		}
	}

	// Remove the migration record
	_, err = tx.ExecContext(ctx, "DELETE FROM schema_migrations WHERE version = ?", version)
	if err != nil {
		return fmt.Errorf("failed to remove migration record %d: %w", version, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback %d: %w", version, err)
	}

	return nil
}

// GetMigrationStatus returns the current migration status
func (m *MigrationManager) GetMigrationStatus(ctx context.Context) (map[int]bool, error) {
	applied, err := m.GetAppliedMigrations(ctx)
	if err != nil {
		return nil, err
	}

	status := make(map[int]bool)
	for _, migration := range m.migrations {
		status[migration.Version] = false
	}

	for _, version := range applied {
		status[version] = true
	}

	return status, nil
}

// generateChecksum creates a simple checksum for migration content
func generateChecksum(content string) string {
	// Simple hash based on content length and first/last characters
	if len(content) == 0 {
		return "empty"
	}
	
	hash := len(content)
	if len(content) > 0 {
		hash += int(content[0])
	}
	if len(content) > 1 {
		hash += int(content[len(content)-1])
	}
	
	return strconv.Itoa(hash)
}

// getBuiltInMigrations returns the built-in migrations
func getBuiltInMigrations() []Migration {
	return []Migration{
		{
			Version:     1,
			Description: "Initial schema creation",
			Up: `
				CREATE TABLE IF NOT EXISTS Images (
					id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL UNIQUE,
					isChecked INTEGER NOT NULL DEFAULT 0,
					isSelected INTEGER NOT NULL DEFAULT 0,
					width INTEGER NOT NULL,
					height INTEGER NOT NULL,
					format TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS Playlists (
					id INTEGER NOT NULL PRIMARY KEY,
					name TEXT NOT NULL UNIQUE,
					type TEXT NOT NULL,
					interval INTEGER,
					showAnimations INTEGER NOT NULL DEFAULT 1,
					alwaysStartOnFirstImage INTEGER NOT NULL DEFAULT 0,
					"order" TEXT,
					currentImageIndex INTEGER NOT NULL DEFAULT 0
				);

				CREATE TABLE IF NOT EXISTS imagesInPlaylist (
					imageID INTEGER NOT NULL,
					playlistID INTEGER NOT NULL,
					indexInPlaylist INTEGER NOT NULL,
					time INTEGER,
					FOREIGN KEY (imageID) REFERENCES Images(id) ON UPDATE CASCADE ON DELETE CASCADE,
					FOREIGN KEY (playlistID) REFERENCES Playlists(id) ON UPDATE CASCADE ON DELETE CASCADE
				);

				CREATE TABLE IF NOT EXISTS swwwConfig (
					config TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS appConfig (
					config TEXT NOT NULL
				);

				CREATE TABLE IF NOT EXISTS activePlaylists (
					playlistID INTEGER NOT NULL,
					activeMonitor TEXT NOT NULL,
					activeMonitorName TEXT NOT NULL UNIQUE,
					FOREIGN KEY (playlistID) REFERENCES Playlists(id)
				);

				CREATE TABLE IF NOT EXISTS imageHistory (
					imageID INTEGER NOT NULL,
					monitor TEXT NOT NULL,
					time TEXT DEFAULT (strftime('%s', 'now')),
					FOREIGN KEY (imageID) REFERENCES Images(id) ON DELETE CASCADE
				);

				CREATE TABLE IF NOT EXISTS selectedMonitor (
					monitor TEXT NOT NULL
				);
			`,
			Down: `
				DROP TABLE IF EXISTS selectedMonitor;
				DROP TABLE IF EXISTS imageHistory;
				DROP TABLE IF EXISTS activePlaylists;
				DROP TABLE IF EXISTS appConfig;
				DROP TABLE IF EXISTS swwwConfig;
				DROP TABLE IF EXISTS imagesInPlaylist;
				DROP TABLE IF EXISTS Playlists;
				DROP TABLE IF EXISTS Images;
			`,
		},
		{
			Version:     2,
			Description: "Add indexes for performance optimization",
			Up: `
				CREATE INDEX IF NOT EXISTS idx_images_name ON Images(name);
				CREATE INDEX IF NOT EXISTS idx_images_format ON Images(format);
				CREATE INDEX IF NOT EXISTS idx_images_dimensions ON Images(width, height);
				CREATE INDEX IF NOT EXISTS idx_playlists_name ON Playlists(name);
				CREATE INDEX IF NOT EXISTS idx_playlists_type ON Playlists(type);
				CREATE INDEX IF NOT EXISTS idx_images_in_playlist_playlist ON imagesInPlaylist(playlistID);
				CREATE INDEX IF NOT EXISTS idx_images_in_playlist_image ON imagesInPlaylist(imageID);
				CREATE INDEX IF NOT EXISTS idx_images_in_playlist_index ON imagesInPlaylist(playlistID, indexInPlaylist);
				CREATE INDEX IF NOT EXISTS idx_image_history_image ON imageHistory(imageID);
				CREATE INDEX IF NOT EXISTS idx_image_history_monitor ON imageHistory(monitor);
				CREATE INDEX IF NOT EXISTS idx_image_history_time ON imageHistory(time DESC);
				CREATE INDEX IF NOT EXISTS idx_active_playlists_monitor ON activePlaylists(activeMonitorName);
			`,
			Down: `
				DROP INDEX IF EXISTS idx_active_playlists_monitor;
				DROP INDEX IF EXISTS idx_image_history_time;
				DROP INDEX IF EXISTS idx_image_history_monitor;
				DROP INDEX IF EXISTS idx_image_history_image;
				DROP INDEX IF EXISTS idx_images_in_playlist_index;
				DROP INDEX IF EXISTS idx_images_in_playlist_image;
				DROP INDEX IF EXISTS idx_images_in_playlist_playlist;
				DROP INDEX IF EXISTS idx_playlists_type;
				DROP INDEX IF EXISTS idx_playlists_name;
				DROP INDEX IF EXISTS idx_images_dimensions;
				DROP INDEX IF EXISTS idx_images_format;
				DROP INDEX IF EXISTS idx_images_name;
			`,
		},
		{
			Version:     3,
			Description: "Add database constraints and triggers",
			Up: `
				-- Add constraint to ensure positive image dimensions
				CREATE TRIGGER IF NOT EXISTS check_image_dimensions
				BEFORE INSERT ON Images
				FOR EACH ROW
				WHEN NEW.width <= 0 OR NEW.height <= 0
				BEGIN
					SELECT RAISE(ABORT, 'Image dimensions must be positive');
				END;

				-- Add constraint to ensure valid playlist intervals
				CREATE TRIGGER IF NOT EXISTS check_playlist_interval
				BEFORE INSERT ON Playlists
				FOR EACH ROW
				WHEN NEW.interval IS NOT NULL AND NEW.interval <= 0
				BEGIN
					SELECT RAISE(ABORT, 'Playlist interval must be positive');
				END;

				-- Add trigger to clean up playlist images when playlist is deleted
				CREATE TRIGGER IF NOT EXISTS cleanup_playlist_images
				AFTER DELETE ON Playlists
				FOR EACH ROW
				BEGIN
					DELETE FROM imagesInPlaylist WHERE playlistID = OLD.id;
				END;

				-- Add trigger to clean up active playlists when playlist is deleted
				CREATE TRIGGER IF NOT EXISTS cleanup_active_playlists
				AFTER DELETE ON Playlists
				FOR EACH ROW
				BEGIN
					DELETE FROM activePlaylists WHERE playlistID = OLD.id;
				END;
			`,
			Down: `
				DROP TRIGGER IF EXISTS cleanup_active_playlists;
				DROP TRIGGER IF EXISTS cleanup_playlist_images;
				DROP TRIGGER IF EXISTS check_playlist_interval;
				DROP TRIGGER IF EXISTS check_image_dimensions;
			`,
		},
	}
}
