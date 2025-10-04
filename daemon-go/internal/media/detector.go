package media

import (
	"fmt"
	"mime"
	"path/filepath"
	"strings"
)

// MediaType represents the type of media file
type MediaType string

const (
	MediaTypeImage MediaType = "image"
	MediaTypeVideo MediaType = "video"
	MediaTypeHTML  MediaType = "html"
	MediaType3D    MediaType = "3d"
	MediaTypeAudio MediaType = "audio"
	MediaTypeOther MediaType = "other"
)

// Detector handles media type detection
type Detector struct {
	typeMap map[string]MediaType
}

// NewDetector creates a new media detector
func NewDetector() *Detector {
	return &Detector{
		typeMap: map[string]MediaType{
			// Image formats
			".jpg": MediaTypeImage, ".jpeg": MediaTypeImage,
			".png": MediaTypeImage, ".webp": MediaTypeImage,
			".gif": MediaTypeImage, ".svg": MediaTypeImage,
			".bmp": MediaTypeImage, ".tiff": MediaTypeImage,
			".tif": MediaTypeImage, ".ico": MediaTypeImage,
			".raw": MediaTypeImage, ".heic": MediaTypeImage,
			".heif": MediaTypeImage, ".avif": MediaTypeImage,

			// Video formats
			".mp4": MediaTypeVideo, ".mkv": MediaTypeVideo,
			".avi": MediaTypeVideo, ".mov": MediaTypeVideo,
			".webm": MediaTypeVideo, ".flv": MediaTypeVideo,
			".wmv": MediaTypeVideo, ".m4v": MediaTypeVideo,
			".3gp": MediaTypeVideo, ".ogv": MediaTypeVideo,
			".mts": MediaTypeVideo, ".m2ts": MediaTypeVideo,

			// HTML/Web files
			".html": MediaTypeHTML, ".htm": MediaTypeHTML,

			// 3D Model formats
			".glb": MediaType3D, ".gltf": MediaType3D,
			".fbx": MediaType3D, ".obj": MediaType3D,
			".dae": MediaType3D, ".3ds": MediaType3D,
			".max": MediaType3D, ".blend": MediaType3D,
			".ma": MediaType3D, ".mb": MediaType3D,
			".c4d": MediaType3D, ".usdz": MediaType3D,

			// Audio formats (for future multimedia wallpapers)
			".mp3": MediaTypeAudio, ".wav": MediaTypeAudio,
			".flac": MediaTypeAudio, ".aac": MediaTypeAudio,
			".ogg": MediaTypeAudio, ".m4a": MediaTypeAudio,
		},
	}
}

// DetectMediaType detects the media type of a file based on its extension
func (d *Detector) DetectMediaType(filePath string) MediaType {
	ext := strings.ToLower(filepath.Ext(filePath))
	if mediaType, exists := d.typeMap[ext]; exists {
		return mediaType
	}

	// Check MIME type as fallback
	mediaType := d.detectFromMIMEType(filePath)
	if mediaType != MediaTypeOther {
		return mediaType
	}

	// Default fallback for unknown extensions
	return MediaTypeImage
}

// detectFromMIMEType uses MIME type detection as a fallback
func (d *Detector) detectFromMIMEType(filePath string) MediaType {
	// Get MIME type
	mimeType := mime.TypeByExtension(filepath.Ext(filePath))
	if mimeType == "" {
		return MediaTypeOther
	}

	// Categorize based on MIME type prefix
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return MediaTypeImage
	case strings.HasPrefix(mimeType, "video/"):
		return MediaTypeVideo
	case strings.HasPrefix(mimeType, "audio/"):
		return MediaTypeAudio
	case strings.Contains(mimeType, "html") || strings.Contains(mimeType, "text/html"):
		return MediaTypeHTML
	default:
		return MediaTypeOther
	}
}

// GetSupportedExtensions returns all supported extensions for a media type
func (d *Detector) GetSupportedExtensions(mediaType MediaType) []string {
	var extensions []string
	for ext, mt := range d.typeMap {
		if mt == mediaType {
			extensions = append(extensions, ext)
		}
	}
	return extensions
}

// IsSupportedExtension checks if an extension is supported
func (d *Detector) IsSupportedExtension(ext string) bool {
	ext = strings.ToLower(ext)
	_, exists := d.typeMap[ext]
	return exists
}

// GetMediaTypeInfo returns detailed information about a media type
func (d *Detector) GetMediaTypeInfo(mediaType MediaType) MediaTypeInfo {
	switch mediaType {
	case MediaTypeImage:
		return MediaTypeInfo{
			Name:                "Image",
			Description:         "Static and animated images",
			Extensions:          d.GetSupportedExtensions(MediaTypeImage),
			RecommendedBackends: []string{"swww", "feh", "nitrogen"},
		}
	case MediaTypeVideo:
		return MediaTypeInfo{
			Name:                "Video",
			Description:         "Dynamic video backgrounds",
			Extensions:          d.GetSupportedExtensions(MediaTypeVideo),
			RecommendedBackends: []string{"mpv", "vlc", "ffplay"},
		}
	case MediaTypeHTML:
		return MediaTypeInfo{
			Name:                "HTML",
			Description:         "Interactive web-based wallpapers",
			Extensions:          d.GetSupportedExtensions(MediaTypeHTML),
			RecommendedBackends: []string{"electron-wallpaper", "webview-wallpaper"},
		}
	case MediaType3D:
		return MediaTypeInfo{
			Name:                "3D Model",
			Description:         "Real-time 3D rendered backgrounds",
			Extensions:          d.GetSupportedExtensions(MediaType3D),
			RecommendedBackends: []string{"threejs-wallpaper", "webgl-wallpaper"},
		}
	case MediaTypeAudio:
		return MediaTypeInfo{
			Name:                "Audio",
			Description:         "Audio files for multimedia wallpapers",
			Extensions:          d.GetSupportedExtensions(MediaTypeAudio),
			RecommendedBackends: []string{}, // Audio usually paired with other media
		}
	default:
		return MediaTypeInfo{
			Name:                "Other",
			Description:         "Unrecognized media type",
			Extensions:          []string{},
			RecommendedBackends: []string{},
		}
	}
}

// MediaTypeInfo contains detailed information about a media type
type MediaTypeInfo struct {
	Name                string   `json:"name"`
	Description         string   `json:"description"`
	Extensions          []string `json:"extensions"`
	RecommendedBackends []string `json:"recommended_backends"`
}

// ValidateMediaFile performs basic validation for a media file
func (d *Detector) ValidateMediaFile(filePath string) ValidationResult {
	result := ValidationResult{
		FilePath: filePath,
		IsValid:  true,
	}

	// Check if file exists
	if _, err := filepath.Abs(filePath); err != nil {
		result.IsValid = false
		result.ErrorMessage = fmt.Sprintf("Invalid file path: %v", err)
		return result
	}

	// Detect media type
	result.MediaType = d.DetectMediaType(filePath)
	result.Extension = strings.ToLower(filepath.Ext(filePath))

	// Check if extension is supported
	if !d.IsSupportedExtension(result.Extension) {
		result.IsValid = false
		result.ErrorMessage = fmt.Sprintf("Unsupported file extension: %s", result.Extension)
		return result
	}

	return result
}

// ValidationResult contains validation results for a media file
type ValidationResult struct {
	FilePath     string    `json:"file_path"`
	MediaType    MediaType `json:"media_type"`
	Extension    string    `json:"extension"`
	IsValid      bool      `json:"is_valid"`
	ErrorMessage string    `json:"error_message,omitempty"`
}

// GetBestBackendForMediaType returns the recommended backend for a media type
func (d *Detector) GetBestBackendForMediaType(mediaType MediaType) string {
	info := d.GetMediaTypeInfo(mediaType)
	if len(info.RecommendedBackends) > 0 {
		return info.RecommendedBackends[0]
	}
	return "unknown"
}
