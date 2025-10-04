# Requirements Document

## Introduction

This feature involves a complete rewrite of the waypaper-engine daemon from Node.js/TypeScript to Go. The primary goals are to eliminate external dependencies (drizzle, bashly, sharp), consolidate image manipulation functionality within the Go daemon, migrate all database operations to Go, and rewrite the CLI from bashly to native Go. This will result in a more performant, self-contained system with fewer runtime dependencies.

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the daemon to be written in Go instead of Node.js, so that I have better performance and fewer runtime dependencies.

#### Acceptance Criteria

1. WHEN the system starts THEN the daemon SHALL be a compiled Go binary instead of a Node.js process
2. WHEN the daemon runs THEN it SHALL consume less memory than the current Node.js implementation
3. WHEN the daemon starts THEN it SHALL not require Node.js runtime or npm packages to be installed
4. WHEN the daemon is deployed THEN it SHALL be a single binary executable

### Requirement 2

**User Story:** As a developer, I want all image manipulation to be handled by the Go daemon, so that I can eliminate the sharp dependency and centralize image processing.

#### Acceptance Criteria

1. WHEN image resizing is needed THEN the Go daemon SHALL handle resizing using native Go image libraries
2. WHEN image format conversion is required THEN the Go daemon SHALL convert between formats without external dependencies
3. WHEN image metadata extraction is needed THEN the Go daemon SHALL extract EXIF and other metadata using Go libraries
4. WHEN thumbnail generation is requested THEN the Go daemon SHALL generate thumbnails internally
5. WHEN the electron app needs image operations THEN it SHALL make API calls to the Go daemon instead of using sharp directly

### Requirement 3

**User Story:** As a developer, I want all database operations to be handled by the Go daemon, so that I can eliminate the drizzle ORM dependency and have consistent data access patterns.

#### Acceptance Criteria

1. WHEN database queries are needed THEN the Go daemon SHALL execute them using native Go database drivers
2. WHEN database migrations are required THEN the Go daemon SHALL handle schema migrations internally
3. WHEN the electron app needs data THEN it SHALL request it from the Go daemon via API calls
4. WHEN data persistence is needed THEN the Go daemon SHALL manage all CRUD operations
5. WHEN the system starts THEN the Go daemon SHALL initialize and manage the database connection pool

### Requirement 4

**User Story:** As a user, I want the CLI to be a native Go application instead of bashly scripts, so that I have better performance and cross-platform compatibility.

#### Acceptance Criteria

1. WHEN I run CLI commands THEN they SHALL be executed by a compiled Go binary
2. WHEN I use CLI functionality THEN it SHALL have the same interface and behavior as the current bashly implementation
3. WHEN CLI commands are executed THEN they SHALL communicate with the Go daemon via the same IPC mechanisms
4. WHEN the CLI is installed THEN it SHALL not require bash or bashly to be present on the system
5. WHEN CLI help is requested THEN it SHALL display comprehensive usage information

### Requirement 5

**User Story:** As a developer, I want the Go daemon to provide a comprehensive API, so that the electron app can interact with all daemon functionality through well-defined interfaces.

#### Acceptance Criteria

1. WHEN the electron app needs playlist operations THEN the Go daemon SHALL provide REST/IPC endpoints for playlist management
2. WHEN the electron app needs image operations THEN the Go daemon SHALL provide endpoints for image manipulation and metadata
3. WHEN the electron app needs database access THEN the Go daemon SHALL provide endpoints for all data operations
4. WHEN API calls are made THEN the Go daemon SHALL return structured responses with proper error handling
5. WHEN the daemon starts THEN it SHALL expose all necessary endpoints for electron app integration

### Requirement 6

**User Story:** As a system user, I want the migration from Node.js to Go to be seamless, so that existing functionality continues to work without interruption.

#### Acceptance Criteria

1. WHEN the Go daemon replaces the Node.js daemon THEN all existing playlist functionality SHALL continue to work
2. WHEN the Go CLI replaces bashly scripts THEN all existing CLI commands SHALL maintain the same behavior
3. WHEN the migration is complete THEN the electron app SHALL function identically to the current implementation
4. WHEN existing data is present THEN the Go daemon SHALL read and migrate existing database schemas and data
5. WHEN configuration files exist THEN the Go daemon SHALL read and respect existing configuration settings

### Requirement 7

**User Story:** As a developer, I want proper error handling and logging in the Go implementation, so that I can debug issues and monitor system health effectively.

#### Acceptance Criteria

1. WHEN errors occur THEN the Go daemon SHALL log detailed error information with appropriate log levels
2. WHEN API calls fail THEN the Go daemon SHALL return structured error responses with meaningful messages
3. WHEN the daemon starts THEN it SHALL log initialization status and configuration information
4. WHEN database operations fail THEN the Go daemon SHALL handle errors gracefully and provide recovery mechanisms
5. WHEN image processing fails THEN the Go daemon SHALL return appropriate error codes and messages

### Requirement 8

**User Story:** As a developer, I want the Go implementation to maintain backward compatibility with existing IPC protocols, so that the electron app integration requires minimal changes.

#### Acceptance Criteria

1. WHEN IPC messages are sent THEN the Go daemon SHALL understand the existing message format
2. WHEN responses are returned THEN they SHALL match the expected structure from the Node.js implementation
3. WHEN the electron app connects THEN it SHALL be able to communicate without protocol changes
4. WHEN existing IPC endpoints are called THEN the Go daemon SHALL provide equivalent functionality
5. WHEN message serialization is needed THEN the Go daemon SHALL use compatible JSON structures