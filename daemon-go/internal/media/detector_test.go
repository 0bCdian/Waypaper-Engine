package media

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewDetector(t *testing.T) {
	detector := NewDetector()

	require.NotNil(t, detector)
	require.NotNil(t, detector.typeMap)
	assert.Greater(t, len(detector.typeMap), 0)
}

func TestDetector_DetectMediaType(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name         string
		filePath     string
		expectedType MediaType
	}{
		// Image formats
		{
			name:         "JPEG file",
			filePath:     "test.jpg",
			expectedType: MediaTypeImage,
		},
		{
			name:         "PNG file",
			filePath:     "image.png",
			expectedType: MediaTypeImage,
		},
		{
			name:         "WebP file",
			filePath:     "photo.webp",
			expectedType: MediaTypeImage,
		},
		{
			name:         "GIF file",
			filePath:     "animation.gif",
			expectedType: MediaTypeImage,
		},
		{
			name:         "SVG file",
			filePath:     "icon.svg",
			expectedType: MediaTypeImage,
		},
		{
			name:         "BMP file",
			filePath:     "bitmap.bmp",
			expectedType: MediaTypeImage,
		},
		{
			name:         "TIFF file",
			filePath:     "scan.tiff",
			expectedType: MediaTypeImage,
		},
		{
			name:         "ICO file",
			filePath:     "favicon.ico",
			expectedType: MediaTypeImage,
		},
		{
			name:         "HEIC file",
			filePath:     "iphone.heic",
			expectedType: MediaTypeImage,
		},
		{
			name:         "AVIF file",
			filePath:     "modern.avif",
			expectedType: MediaTypeImage,
		},

		// Video formats
		{
			name:         "MP4 file",
			filePath:     "video.mp4",
			expectedType: MediaTypeVideo,
		},
		{
			name:         "MKV file",
			filePath:     "movie.mkv",
			expectedType: MediaTypeVideo,
		},
		{
			name:         "AVI file",
			filePath:     "clip.avi",
			expectedType: MediaTypeVideo,
		},
		{
			name:         "WebM file",
			filePath:     "web.webm",
			expectedType: MediaTypeVideo,
		},

		// HTML formats
		{
			name:         "HTML file",
			filePath:     "page.html",
			expectedType: MediaTypeHTML,
		},
		{
			name:         "HTM file",
			filePath:     "legacy.htm",
			expectedType: MediaTypeHTML,
		},

		// 3D formats
		{
			name:         "GLB file",
			filePath:     "model.glb",
			expectedType: MediaType3D,
		},
		{
			name:         "OBJ file",
			filePath:     "mesh.obj",
			expectedType: MediaType3D,
		},
		{
			name:         "FBX file",
			filePath:     "animation.fbx",
			expectedType: MediaType3D,
		},

		// Audio formats
		{
			name:         "MP3 file",
			filePath:     "song.mp3",
			expectedType: MediaTypeAudio,
		},
		{
			name:         "WAV file",
			filePath:     "sound.wav",
			expectedType: MediaTypeAudio,
		},
		{
			name:         "FLAC file",
			filePath:     "lossless.flac",
			expectedType: MediaTypeAudio,
		},

		// Case insensitive
		{
			name:         "Uppercase extension",
			filePath:     "IMAGE.JPG",
			expectedType: MediaTypeImage,
		},
		{
			name:         "Mixed case extension",
			filePath:     "Video.Mp4",
			expectedType: MediaTypeVideo,
		},

		// Unknown extensions (should default to image)
		{
			name:         "Unknown extension",
			filePath:     "unknown.xyz",
			expectedType: MediaTypeImage,
		},
		{
			name:         "No extension",
			filePath:     "noextension",
			expectedType: MediaTypeImage,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.DetectMediaType(tt.filePath)
			assert.Equal(t, tt.expectedType, result)
		})
	}
}

func TestDetector_GetSupportedExtensions(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name        string
		mediaType   MediaType
		minExpected int
	}{
		{
			name:        "Image extensions",
			mediaType:   MediaTypeImage,
			minExpected: 10, // Should have many image formats
		},
		{
			name:        "Video extensions",
			mediaType:   MediaTypeVideo,
			minExpected: 5, // Should have several video formats
		},
		{
			name:        "HTML extensions",
			mediaType:   MediaTypeHTML,
			minExpected: 2, // Should have html and htm
		},
		{
			name:        "3D extensions",
			mediaType:   MediaType3D,
			minExpected: 5, // Should have several 3D formats
		},
		{
			name:        "Audio extensions",
			mediaType:   MediaTypeAudio,
			minExpected: 3, // Should have several audio formats
		},
		{
			name:        "Other extensions",
			mediaType:   MediaTypeOther,
			minExpected: 0, // Should have no extensions
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			extensions := detector.GetSupportedExtensions(tt.mediaType)
			assert.GreaterOrEqual(t, len(extensions), tt.minExpected)

			// Verify all returned extensions are valid
			for _, ext := range extensions {
				assert.True(t, detector.IsSupportedExtension(ext))
			}
		})
	}
}

func TestDetector_IsSupportedExtension(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name      string
		extension string
		expected  bool
	}{
		{
			name:      "Supported image extension",
			extension: ".jpg",
			expected:  true,
		},
		{
			name:      "Supported video extension",
			extension: ".mp4",
			expected:  true,
		},
		{
			name:      "Case insensitive",
			extension: ".JPG",
			expected:  true,
		},
		{
			name:      "Mixed case",
			extension: ".Mp4",
			expected:  true,
		},
		{
			name:      "Unsupported extension",
			extension: ".xyz",
			expected:  false,
		},
		{
			name:      "Empty extension",
			extension: "",
			expected:  false,
		},
		{
			name:      "No dot",
			extension: "jpg",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.IsSupportedExtension(tt.extension)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDetector_GetMediaTypeInfo(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name         string
		mediaType    MediaType
		expectedName string
	}{
		{
			name:         "Image info",
			mediaType:    MediaTypeImage,
			expectedName: "Image",
		},
		{
			name:         "Video info",
			mediaType:    MediaTypeVideo,
			expectedName: "Video",
		},
		{
			name:         "HTML info",
			mediaType:    MediaTypeHTML,
			expectedName: "HTML",
		},
		{
			name:         "3D info",
			mediaType:    MediaType3D,
			expectedName: "3D Model",
		},
		{
			name:         "Audio info",
			mediaType:    MediaTypeAudio,
			expectedName: "Audio",
		},
		{
			name:         "Other info",
			mediaType:    MediaTypeOther,
			expectedName: "Other",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := detector.GetMediaTypeInfo(tt.mediaType)

			assert.Equal(t, tt.expectedName, info.Name)
			assert.NotEmpty(t, info.Description)
			assert.NotNil(t, info.Extensions)
			assert.NotNil(t, info.RecommendedBackends)
		})
	}
}

func TestDetector_ValidateMediaFile(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name        string
		filePath    string
		expectValid bool
	}{
		{
			name:        "Valid image file",
			filePath:    "test.jpg",
			expectValid: true,
		},
		{
			name:        "Valid video file",
			filePath:    "movie.mp4",
			expectValid: true,
		},
		{
			name:        "Unsupported extension",
			filePath:    "document.xyz",
			expectValid: false,
		},
		{
			name:        "Empty path",
			filePath:    "",
			expectValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.ValidateMediaFile(tt.filePath)

			assert.Equal(t, tt.filePath, result.FilePath)
			assert.Equal(t, tt.expectValid, result.IsValid)

			if tt.expectValid {
				assert.Empty(t, result.ErrorMessage)
				assert.NotEmpty(t, result.Extension)
			} else {
				assert.NotEmpty(t, result.ErrorMessage)
			}
		})
	}
}

func TestDetector_GetBestBackendForMediaType(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name            string
		mediaType       MediaType
		expectedBackend string
	}{
		{
			name:            "Image backend",
			mediaType:       MediaTypeImage,
			expectedBackend: "swww",
		},
		{
			name:            "Video backend",
			mediaType:       MediaTypeVideo,
			expectedBackend: "mpv",
		},
		{
			name:            "HTML backend",
			mediaType:       MediaTypeHTML,
			expectedBackend: "electron-wallpaper",
		},
		{
			name:            "3D backend",
			mediaType:       MediaType3D,
			expectedBackend: "threejs-wallpaper",
		},
		{
			name:            "Audio backend",
			mediaType:       MediaTypeAudio,
			expectedBackend: "unknown",
		},
		{
			name:            "Other backend",
			mediaType:       MediaTypeOther,
			expectedBackend: "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backend := detector.GetBestBackendForMediaType(tt.mediaType)
			assert.Equal(t, tt.expectedBackend, backend)
		})
	}
}

func TestDetector_DetectFromMIMEType(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name         string
		filePath     string
		expectedType MediaType
	}{
		{
			name:         "Image MIME type",
			filePath:     "test.jpg",
			expectedType: MediaTypeImage,
		},
		{
			name:         "Video MIME type",
			filePath:     "movie.mp4",
			expectedType: MediaTypeVideo,
		},
		{
			name:         "Audio MIME type",
			filePath:     "song.mp3",
			expectedType: MediaTypeAudio,
		},
		{
			name:         "Unknown MIME type",
			filePath:     "unknown.xyz",
			expectedType: MediaTypeOther,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.detectFromMIMEType(tt.filePath)
			assert.Equal(t, tt.expectedType, result)
		})
	}
}

func TestDetector_AllImageFormats(t *testing.T) {
	detector := NewDetector()
	imageExtensions := detector.GetSupportedExtensions(MediaTypeImage)

	// Test that all image extensions are detected correctly
	for _, ext := range imageExtensions {
		t.Run("Image format "+ext, func(t *testing.T) {
			filePath := "test" + ext
			result := detector.DetectMediaType(filePath)
			assert.Equal(t, MediaTypeImage, result)
		})
	}
}

func TestDetector_AllVideoFormats(t *testing.T) {
	detector := NewDetector()
	videoExtensions := detector.GetSupportedExtensions(MediaTypeVideo)

	// Test that all video extensions are detected correctly
	for _, ext := range videoExtensions {
		t.Run("Video format "+ext, func(t *testing.T) {
			filePath := "test" + ext
			result := detector.DetectMediaType(filePath)
			assert.Equal(t, MediaTypeVideo, result)
		})
	}
}

func TestDetector_AllAudioFormats(t *testing.T) {
	detector := NewDetector()
	audioExtensions := detector.GetSupportedExtensions(MediaTypeAudio)

	// Test that all audio extensions are detected correctly
	for _, ext := range audioExtensions {
		t.Run("Audio format "+ext, func(t *testing.T) {
			filePath := "test" + ext
			result := detector.DetectMediaType(filePath)
			assert.Equal(t, MediaTypeAudio, result)
		})
	}
}

func TestDetector_All3DFormats(t *testing.T) {
	detector := NewDetector()
	threeDExtensions := detector.GetSupportedExtensions(MediaType3D)

	// Test that all 3D extensions are detected correctly
	for _, ext := range threeDExtensions {
		t.Run("3D format "+ext, func(t *testing.T) {
			filePath := "test" + ext
			result := detector.DetectMediaType(filePath)
			assert.Equal(t, MediaType3D, result)
		})
	}
}

func TestDetector_AllHTMLFormats(t *testing.T) {
	detector := NewDetector()
	htmlExtensions := detector.GetSupportedExtensions(MediaTypeHTML)

	// Test that all HTML extensions are detected correctly
	for _, ext := range htmlExtensions {
		t.Run("HTML format "+ext, func(t *testing.T) {
			filePath := "test" + ext
			result := detector.DetectMediaType(filePath)
			assert.Equal(t, MediaTypeHTML, result)
		})
	}
}

func TestDetector_EdgeCases(t *testing.T) {
	detector := NewDetector()

	tests := []struct {
		name     string
		filePath string
	}{
		{
			name:     "Multiple dots",
			filePath: "file.backup.jpg",
		},
		{
			name:     "Hidden file",
			filePath: ".hidden.jpg",
		},
		{
			name:     "Path with directories",
			filePath: "/path/to/image.png",
		},
		{
			name:     "Windows path",
			filePath: "C:\\path\\to\\image.png",
		},
		{
			name:     "URL-like path",
			filePath: "https://example.com/image.jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detector.DetectMediaType(tt.filePath)
			// Should not panic and should return a valid MediaType
			assert.NotEmpty(t, result)
			assert.Contains(t, []MediaType{
				MediaTypeImage,
				MediaTypeVideo,
				MediaTypeHTML,
				MediaType3D,
				MediaTypeAudio,
				MediaTypeOther,
			}, result)
		})
	}
}
