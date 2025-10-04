package db

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// PoolConfig holds configuration for the database connection pool
type PoolConfig struct {
	MaxOpenConns    int           // Maximum number of open connections
	MaxIdleConns    int           // Maximum number of idle connections
	ConnMaxLifetime time.Duration // Maximum lifetime of a connection
	ConnMaxIdleTime time.Duration // Maximum idle time of a connection
}

// DefaultPoolConfig returns a default pool configuration
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MaxOpenConns:    25,
		MaxIdleConns:    5,
		ConnMaxLifetime: time.Hour,
		ConnMaxIdleTime: time.Minute * 15,
	}
}

// DatabaseManager manages database connections, transactions, and migrations
type DatabaseManager struct {
	db               *sql.DB
	queries          *Queries
	migrationManager *MigrationManager
	config           PoolConfig
	mu               sync.RWMutex
	closed           bool
}

// NewDatabaseManager creates a new database manager with connection pooling
func NewDatabaseManager(dataSourceName string, config PoolConfig) (*DatabaseManager, error) {
	db, err := sql.Open("sqlite3", dataSourceName+"?_journal_mode=WAL&_synchronous=NORMAL&_cache_size=1000&_foreign_keys=ON")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(config.MaxOpenConns)
	db.SetMaxIdleConns(config.MaxIdleConns)
	db.SetConnMaxLifetime(config.ConnMaxLifetime)
	db.SetConnMaxIdleTime(config.ConnMaxIdleTime)

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	manager := &DatabaseManager{
		db:               db,
		queries:          New(db),
		migrationManager: NewMigrationManager(db),
		config:           config,
	}

	return manager, nil
}

// Initialize sets up the database with migrations
func (dm *DatabaseManager) Initialize(ctx context.Context) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	// Initialize migration table
	if err := dm.migrationManager.InitMigrationTable(ctx); err != nil {
		return fmt.Errorf("failed to initialize migration table: %w", err)
	}

	// Apply pending migrations
	if err := dm.migrationManager.ApplyPendingMigrations(ctx); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	return nil
}

// GetQueries returns the queries instance
func (dm *DatabaseManager) GetQueries() *Queries {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.queries
}

// GetDB returns the underlying database connection
func (dm *DatabaseManager) GetDB() *sql.DB {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.db
}

// GetMigrationManager returns the migration manager
func (dm *DatabaseManager) GetMigrationManager() *MigrationManager {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.migrationManager
}

// Transaction executes a function within a database transaction
func (dm *DatabaseManager) Transaction(ctx context.Context, fn func(*Queries) error) error {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	tx, err := dm.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	queries := dm.queries.WithTx(tx)
	if err := fn(queries); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// ReadOnlyTransaction executes a function within a read-only transaction
func (dm *DatabaseManager) ReadOnlyTransaction(ctx context.Context, fn func(*Queries) error) error {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	tx, err := dm.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return fmt.Errorf("failed to begin read-only transaction: %w", err)
	}
	defer tx.Rollback()

	queries := dm.queries.WithTx(tx)
	if err := fn(queries); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit read-only transaction: %w", err)
	}

	return nil
}

// BatchOperation executes multiple operations in a single transaction
type BatchOperation func(*Queries) error

// ExecuteBatch executes multiple operations in a single transaction
func (dm *DatabaseManager) ExecuteBatch(ctx context.Context, operations ...BatchOperation) error {
	return dm.Transaction(ctx, func(q *Queries) error {
		for _, op := range operations {
			if err := op(q); err != nil {
				return err
			}
		}
		return nil
	})
}

// HealthCheck performs a health check on the database
func (dm *DatabaseManager) HealthCheck(ctx context.Context) error {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	// Test basic connectivity
	if err := dm.db.PingContext(ctx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	// Test a simple query
	var result int
	err := dm.db.QueryRowContext(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		return fmt.Errorf("test query failed: %w", err)
	}

	if result != 1 {
		return fmt.Errorf("unexpected test query result: %d", result)
	}

	return nil
}

// GetStats returns database connection statistics
func (dm *DatabaseManager) GetStats() sql.DBStats {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.db.Stats()
}

// Optimize performs database optimization operations
func (dm *DatabaseManager) Optimize(ctx context.Context) error {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	// Run VACUUM to reclaim space
	if _, err := dm.db.ExecContext(ctx, "VACUUM"); err != nil {
		return fmt.Errorf("vacuum failed: %w", err)
	}

	// Run ANALYZE to update statistics
	if _, err := dm.db.ExecContext(ctx, "ANALYZE"); err != nil {
		return fmt.Errorf("analyze failed: %w", err)
	}

	return nil
}

// Close closes the database connection and marks the manager as closed
func (dm *DatabaseManager) Close() error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.closed {
		return nil
	}

	dm.closed = true
	return dm.db.Close()
}

// IsClosed returns whether the database manager is closed
func (dm *DatabaseManager) IsClosed() bool {
	dm.mu.RLock()
	defer dm.mu.RUnlock()
	return dm.closed
}

// Backup creates a backup of the database
func (dm *DatabaseManager) Backup(ctx context.Context, backupPath string) error {
	dm.mu.RLock()
	defer dm.mu.RUnlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	// For SQLite, we can use the backup API or simply copy the file
	// This is a simple implementation using VACUUM INTO
	query := fmt.Sprintf("VACUUM INTO '%s'", backupPath)
	_, err := dm.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("backup failed: %w", err)
	}

	return nil
}

// RestoreFromBackup restores the database from a backup
func (dm *DatabaseManager) RestoreFromBackup(ctx context.Context, backupPath string) error {
	dm.mu.Lock()
	defer dm.mu.Unlock()

	if dm.closed {
		return fmt.Errorf("database manager is closed")
	}

	// Close current connection
	if err := dm.db.Close(); err != nil {
		return fmt.Errorf("failed to close current database: %w", err)
	}

	// This would typically involve file operations to replace the current database
	// with the backup file. For now, we'll return an error indicating manual intervention
	return fmt.Errorf("restore from backup requires manual file replacement")
}