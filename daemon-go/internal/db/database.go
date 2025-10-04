package db

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

// InitDB initializes the database connection and applies the schema.
func InitDB(dataSourceName string) (*Queries, *sql.DB, error) {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, nil, fmt.Errorf("failed to ping db: %w", err)
	}

	// Read and execute the schema
	schema, err := Asset("schema/schema.sql")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read schema asset: %w", err)
	}

	_, err = db.ExecContext(context.Background(), string(schema))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to apply schema: %w", err)
	}

	fmt.Println("Database initialized and schema applied successfully.")

	queries := New(db)
	return queries, db, nil
}
