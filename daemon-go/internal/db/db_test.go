package db

import (
	"context"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

func setupQueriesTestDB(t *testing.T) (*Queries, func()) {
	dbManager, err := NewDatabaseManager("file::memory:", DefaultPoolConfig())
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, dbManager.Initialize(ctx))

	queries := New(dbManager.db)

	// Teardown function to close the database
	teardown := func() {
		dbManager.Close()
	}

	return queries, teardown
}

func TestCreateImage(t *testing.T) {
	queries, teardown := setupQueriesTestDB(t)
	defer teardown()

	arg := CreateImageParams{
		Name:       "test_image.png",
		Ischecked:  0,
		Isselected: 0,
		Width:      1920,
		Height:     1080,
		Format:     "png",
	}

	image, err := queries.CreateImage(context.Background(), arg)
	if err != nil {
		t.Fatalf("CreateImage failed: %v", err)
	}

	if image.ID == 0 {
		t.Error("Expected non-zero ID for created image")
	}
	if image.Name != arg.Name {
		t.Errorf("Expected name %s, got %s", arg.Name, image.Name)
	}

	retrievedImage, err := queries.GetImage(context.Background(), image.ID)
	if err != nil {
		t.Fatalf("GetImage failed: %v", err)
	}

	if retrievedImage.ID != image.ID {
		t.Errorf("Expected retrieved image ID to match created image ID")
	}
}

func TestListImages(t *testing.T) {
	queries, teardown := setupQueriesTestDB(t)
	defer teardown()

	// Create a couple of images
	queries.CreateImage(context.Background(), CreateImageParams{Name: "img2.png", Width: 800, Height: 600, Format: "png", Ischecked: 0, Isselected: 0})
	queries.CreateImage(context.Background(), CreateImageParams{Name: "img1.png", Width: 1024, Height: 768, Format: "png", Ischecked: 0, Isselected: 0})

	images, err := queries.ListImages(context.Background())
	if err != nil {
		t.Fatalf("ListImages failed: %v", err)
	}

	if len(images) != 2 {
		t.Fatalf("Expected 2 images, got %d", len(images))
	}

	// Check if they are ordered by name
	if images[0].Name != "img1.png" || images[1].Name != "img2.png" {
		t.Errorf("Images are not ordered by name correctly")
	}
}
