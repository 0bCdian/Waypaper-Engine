package backend

import (
	"fmt"
	"strings"

	"waypaper-engine/daemon/internal/media"
)

// PickBackend resolves which backend to use for a given media type.
//
// In "fixed" mode it simply returns the currently active backend name.
//
// In "auto" mode it walks the priority list for the media category (image/video/web)
// and returns the first registered, available backend whose Capabilities include the
// requested media type. GIF is treated as "image" for priority resolution.
func PickBackend(reg Registry, mode string, mediaType string, priorities map[string][]string) (string, error) {
	if mode != "auto" {
		active := reg.Active()
		if active == nil {
			return "", fmt.Errorf("no active backend")
		}
		return active.Name(), nil
	}

	category := mediaCategoryKey(mediaType)
	prio, ok := priorities[category]
	if !ok || len(prio) == 0 {
		return "", fmt.Errorf("no priority list configured for media category %q", category)
	}

	for _, name := range prio {
		b, found := reg.Get(name)
		if !found {
			continue
		}
		if !b.IsAvailable() {
			continue
		}
		if SupportsMedia(b.Capabilities(), mediaType) {
			return name, nil
		}
	}

	return "", fmt.Errorf("no available backend supports %q media (tried: %s)", mediaType, strings.Join(prio, ", "))
}

// ValidateAutoPriorities checks that every entry in each priority list references
// a registered backend that supports the corresponding media category. Returns
// a map of category -> list of validation errors. An empty map means valid.
func ValidateAutoPriorities(reg Registry, priorities map[string][]string) map[string][]string {
	errs := make(map[string][]string)
	for category, names := range priorities {
		mt := categoryToMediaType(category)
		for _, name := range names {
			b, found := reg.Get(name)
			if !found {
				errs[category] = append(errs[category], fmt.Sprintf("backend %q is not registered", name))
				continue
			}
			if !SupportsMedia(b.Capabilities(), string(mt)) {
				errs[category] = append(errs[category], fmt.Sprintf("backend %q does not support %s", name, category))
			}
		}
	}
	return errs
}

func mediaCategoryKey(mediaType string) string {
	mt := strings.ToLower(strings.TrimSpace(mediaType))
	switch mt {
	case string(media.MediaTypeVideo):
		return "video"
	case string(media.MediaTypeWeb):
		return "web"
	default:
		return "image"
	}
}

func categoryToMediaType(category string) media.MediaType {
	switch category {
	case "video":
		return media.MediaTypeVideo
	case "web":
		return media.MediaTypeWeb
	default:
		return media.MediaTypeImage
	}
}
