package db

import (
	"context"
)

// GetPlaylist retrieves a single playlist by its ID.
func (q *Queries) GetPlaylist(ctx context.Context, id int64) (Playlist, error) {
	row := q.db.QueryRowContext(ctx, `
        SELECT id, name, type, interval, showAnimations, alwaysStartOnFirstImage, "order", currentImageIndex
        FROM Playlists
        WHERE id = ?
    `, id)

	var p Playlist
	err := row.Scan(
		&p.ID,
		&p.Name,
		&p.Type,
		&p.Interval,
		&p.Showanimations,
		&p.Alwaysstartonfirstimage,
		&p.Order,
		&p.Currentimageindex,
	)
	return p, err
}

// ListImagesByPlaylist retrieves all images associated with a given playlist ID.
func (q *Queries) ListImagesByPlaylist(ctx context.Context, playlistID int64) ([]Image, error) {
	rows, err := q.db.QueryContext(ctx, `
        SELECT i.id, i.name, i.isChecked, i.isSelected, i.width, i.height, i.format
        FROM Images i
        JOIN imagesInPlaylist ip ON i.id = ip.imageID
        WHERE ip.playlistID = ?
    `, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Image
	for rows.Next() {
		var i Image
		if err := rows.Scan(
			&i.ID,
			&i.Name,
			&i.Ischecked,
			&i.Isselected,
			&i.Width,
			&i.Height,
			&i.Format,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, nil
}

// UpdatePlaylistIndex updates the current image index for a playlist.
func (q *Queries) UpdatePlaylistIndex(ctx context.Context, arg UpdatePlaylistIndexParams) error {
	_, err := q.db.ExecContext(ctx, `
        UPDATE Playlists
        SET currentImageIndex = ?
        WHERE id = ?
    `, arg.CurrentImageIndex, arg.ID)
	return err
}

type UpdatePlaylistIndexParams struct {
	CurrentImageIndex int64
	ID                int64
}
