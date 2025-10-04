# Waypaper Engine Migration Tool

This tool migrates your Waypaper Engine data from SQLite to JSON-based storage format for the new version.

## 🚀 **Quick Start**

### Prerequisites
- Have an existing Waypaper Engine SQLite database (usually at `~/.config/waypaper-engine/waypaper.db`)
- Ensure no Waypaper Engine instances are running

### Basic Usage

```bash
# 1. Preview what will be migrated (RECOMMENDED)
./minimal-migrate ~/.config/waypaper-engine/waypaper.db ~/.waypaper-engine/data --dry-run

# 2. Proceed with actual migration
./minimal-migrate ~/.config/waypaper-engine/waypaper.db ~/.waypaper-engine/data
```

## 📋 **What Gets Migrated**

### ✅ **Currently Migrated:**
- **Images**: All your wallpaper images with metadata (dimensions, format, selection status)
- **Image Indices**: Fast lookup tables for searching images

### 🔄 **Future Migration (Coming Soon):**
- **Playlists**: Your playlist configurations and image orders
- **Image History**: History of images that have been displayed
- **Runtime State**: Active playlist states and monitor selections
- **Backend Settings**: s www and other backend configurations

## 🛠 **Migration Tool Options**

| Tool | Purpose | Status |
|------|---------|--------|
| `minimal-migrate.go` | Core migration (images only) | ✅ **Working** |
| `migrate.go` | Full migration with all features | 🔄 **In Development** |
| `simple_migrate.go` | Extended migration tool | 🔄 **In Development** |

## 🔒 **Safety Features**

- **Dry Run**: Preview changes without modifying anything
- **Input Validation**: Verifies SQLite database exists and is accessible
- **Atomic Operations**: JSON writes are atomic - no partial migrations
- **Backup Recommendation**: Always backup your data first

## 🚨 **Important Notes**

### ⚠️ **Breaking Changes**
This migration is for **Waypaper Engine v2.0** which introduces significant changes:
- Complete rewrite from Node.js to Go
- SQLite → JSON storage format
- Enhanced multi-media backend support
- Improved compositor detection

### 📝 **After Migration**
1. **Stop all Waypaper Engine instances**
2. **Update to new v2.0 version** 
3. **Test that everything works correctly**
4. **Remove old SQLite database only after verification**

### 💾 **Backup Recommended**
The tool will **not** automatically backup your SQLite database. Before migration:

```bash
cp ~/.config/waypaper-engine/waypaper.db ~/.config/waypaper-engine/waypaper.db.backup
```

## 🔧 **Building the Migration Tool**

```bash
cd daemon-go
go build -o minimal-migrate ./cmd/migrate/minimal_migrate.go
```

## 📊 **Migration Process**

1. **Validation**: Checks SQLite database connectivity and structure
2. **Data Extraction**: Reads images and metadata from SQLite
3. **Conversion**: Converts to enhanced JSON format with indices
4. **Storage**: Saves to new JSON store with atomic operations
5. **Verification**: Confirms migration completed successfully

## 🐛 **Troubleshooting**

### Common Issues:

**"SQLite database not found"**
- Check if the database path is correct
- Default location: `~/.config/waypaper-engine/waypaper.db`

**"failed to initialize JSON store"**
- Ensure write permissions to JSON destination directory
- Default location: `~/.waypaper-engine/data`

**"Permission denied"**
- Run with appropriate permissions for the target directories
- Ensure Waypaper Engine is not running

## 📈 **Migration Status**

Status: **✅ READY FOR TESTING**

The minimal migration tool is ready and working. Focus currently on:
- ✅ Image migration (working)
- 🔄 Playlist migration (in development)
- 🔄 History migration (in development)
- 🔄 Runtime state migration (planned)

## 🤝 **How to Help**

If you encounter issues or have suggestions:
1. **Test the migration tool** with your data
2. **Report bugs** or unexpected behavior
3. **Suggest improvements** for the migration process
4. **Contribute** additional migration features

## 📚 **Related Documentation**

- [Migration Planning](./../../SQLITE_TO_JSON_MIGRATION_PLAN.md)
- [JSON Store Architecture](../store/)
- [Backend System](../backend/)
- [Configuration Management](../config/)

---

*This tool is part of the Waypaper Engine v2.0 migration to Go-based architecture with enhanced multi-media support.*
