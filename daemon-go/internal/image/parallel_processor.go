package image

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/store"
)

// ParallelImageProcessor handles parallel image processing operations
type ParallelImageProcessor struct {
	cacheDir      string
	thumbnailsDir string
	store         *store.Store
	workers       int
}

// ImageProcessingJob represents a single image processing job
type ImageProcessingJob struct {
	ImagePath           string
	OriginalName        string
	UniqueName          string
	RequiredResolutions []string
}

// ImageProcessingResult represents the result of processing a single image
type ImageProcessingResult struct {
	Job            *ImageProcessingJob
	Metadata       *Metadata
	ThumbnailPaths map[string]string
	Error          error
	ProcessingTime time.Duration
}

// NewParallelImageProcessor creates a new parallel image processor
func NewParallelImageProcessor(cacheDir, thumbnailsDir string, store *store.Store, workers int) *ParallelImageProcessor {
	if workers <= 0 {
		workers = 4 // Default to 4 workers
	}
	return &ParallelImageProcessor{
		cacheDir:      cacheDir,
		thumbnailsDir: thumbnailsDir,
		store:         store,
		workers:       workers,
	}
}

// ProcessImagesInParallel processes multiple images concurrently
func (p *ParallelImageProcessor) ProcessImagesInParallel(ctx context.Context, jobs []*ImageProcessingJob) ([]*ImageProcessingResult, error) {
	if len(jobs) == 0 {
		return nil, fmt.Errorf("no jobs to process")
	}

	// Create channels for job distribution and result collection
	jobChan := make(chan *ImageProcessingJob, len(jobs))
	resultChan := make(chan *ImageProcessingResult, len(jobs))

	// Start worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < p.workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			p.worker(ctx, workerID, jobChan, resultChan)
		}(i)
	}

	// Send jobs to workers
	go func() {
		defer close(jobChan)
		for _, job := range jobs {
			select {
			case jobChan <- job:
			case <-ctx.Done():
				return
			}
		}
	}()

	// Collect results
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Gather results
	var results []*ImageProcessingResult
	for result := range resultChan {
		results = append(results, result)
	}

	return results, nil
}

// worker processes jobs from the job channel
func (p *ParallelImageProcessor) worker(ctx context.Context, workerID int, jobChan <-chan *ImageProcessingJob, resultChan chan<- *ImageProcessingResult) {
	for {
		select {
		case job, ok := <-jobChan:
			if !ok {
				return // Channel closed, worker done
			}

			result := p.processSingleImage(ctx, job)
			resultChan <- result

		case <-ctx.Done():
			return
		}
	}
}

// processSingleImage processes a single image with all operations in parallel
func (p *ParallelImageProcessor) processSingleImage(ctx context.Context, job *ImageProcessingJob) *ImageProcessingResult {
	startTime := time.Now()
	result := &ImageProcessingResult{
		Job: job,
	}

	// Create context with timeout for this image
	imgCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Step 1: Copy image to cache (can be done in parallel with metadata extraction)
	copyDone := make(chan error, 1)
	go func() {
		cachePath := filepath.Join(p.cacheDir, job.UniqueName)
		err := p.copyImageToCache(job.ImagePath, cachePath)
		copyDone <- err
	}()

	// Step 2: Extract metadata (can be done in parallel with copying)
	metadataChan := make(chan *Metadata, 1)
	metadataErrChan := make(chan error, 1)
	go func() {
		metadata, err := ExtractMetadataFromFile(job.ImagePath)
		metadataChan <- metadata
		metadataErrChan <- err
	}()

	// Step 3: Create thumbnails (can be done in parallel with copying and metadata)
	thumbnailsChan := make(chan map[string]string, 1)
	thumbnailsErrChan := make(chan error, 1)
	go func() {
		thumbnails, err := p.createThumbnailsInParallel(job.ImagePath, job.UniqueName, job.RequiredResolutions)
		thumbnailsChan <- thumbnails
		thumbnailsErrChan <- err
	}()

	// Wait for all operations to complete
	var copyErr, metadataErr, thumbnailsErr error
	var metadata *Metadata
	var thumbnails map[string]string

	// Collect results from parallel operations
	select {
	case copyErr = <-copyDone:
	case <-imgCtx.Done():
		result.Error = fmt.Errorf("image processing timeout")
		return result
	}

	select {
	case metadata = <-metadataChan:
		metadataErr = <-metadataErrChan
	case <-imgCtx.Done():
		result.Error = fmt.Errorf("metadata extraction timeout")
		return result
	}

	select {
	case thumbnails = <-thumbnailsChan:
		thumbnailsErr = <-thumbnailsErrChan
	case <-imgCtx.Done():
		result.Error = fmt.Errorf("thumbnail creation timeout")
		return result
	}

	// Check for errors
	if copyErr != nil {
		result.Error = fmt.Errorf("failed to copy image: %w", copyErr)
		return result
	}
	if metadataErr != nil {
		result.Error = fmt.Errorf("failed to extract metadata: %w", metadataErr)
		return result
	}
	if thumbnailsErr != nil {
		result.Error = fmt.Errorf("failed to create thumbnails: %w", thumbnailsErr)
		return result
	}

	// Step 4: Store in database (this needs to be sequential after all parallel ops complete)
	if p.store != nil {
		err := p.storeImageInDatabase(job, metadata, thumbnails)
		if err != nil {
			result.Error = fmt.Errorf("failed to store in database: %w", err)
			return result
		}
	}

	result.Metadata = metadata
	result.ThumbnailPaths = thumbnails
	result.ProcessingTime = time.Since(startTime)

	return result
}

// copyImageToCache copies an image file to the cache directory
func (p *ParallelImageProcessor) copyImageToCache(srcPath, dstPath string) error {
	// Ensure cache directory exists
	if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Copy file
	sourceFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destFile.Close()

	_, err = destFile.ReadFrom(sourceFile)
	if err != nil {
		return fmt.Errorf("failed to copy file: %w", err)
	}

	return nil
}

// createThumbnailsInParallel creates multiple thumbnails concurrently
func (p *ParallelImageProcessor) createThumbnailsInParallel(inputPath, fileName string, requiredResolutions []string) (map[string]string, error) {
	if len(requiredResolutions) == 0 {
		// Default to all resolutions if none specified
		requiredResolutions = []string{"720p", "1080p", "1440p", "4k", "fallback"}
	}

	// Create thumbnails directory
	if err := os.MkdirAll(p.thumbnailsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create thumbnails directory: %w", err)
	}

	// Process thumbnails in parallel
	type thumbnailResult struct {
		resolution string
		path       string
		err        error
	}

	resultChan := make(chan thumbnailResult, len(requiredResolutions))
	var wg sync.WaitGroup

	for _, resolution := range requiredResolutions {
		wg.Add(1)
		go func(res string) {
			defer wg.Done()

			// Create resolution-specific directory
			resolutionDir := filepath.Join(p.thumbnailsDir, res)
			if err := os.MkdirAll(resolutionDir, 0755); err != nil {
				resultChan <- thumbnailResult{res, "", fmt.Errorf("failed to create resolution directory: %w", err)}
				return
			}

			// Create thumbnail filename
			baseName := filepath.Base(fileName)
			baseName = baseName[:len(baseName)-len(filepath.Ext(baseName))]
			thumbnailName := baseName + ".webp"
			thumbnailPath := filepath.Join(resolutionDir, thumbnailName)

			// Get resolution config
			config, err := p.getResolutionConfig(res)
			if err != nil {
				resultChan <- thumbnailResult{res, "", fmt.Errorf("failed to get resolution config: %w", err)}
				return
			}

			// Create thumbnail
			opts := ThumbnailOptions{
				Width:   config.Width,
				Height:  config.Height,
				Quality: config.Quality,
				Format:  "webp",
			}

			_, err = CreateThumbnail(inputPath, thumbnailPath, opts)
			if err != nil {
				resultChan <- thumbnailResult{res, "", fmt.Errorf("failed to create thumbnail: %w", err)}
				return
			}

			resultChan <- thumbnailResult{res, thumbnailPath, nil}
		}(resolution)
	}

	// Wait for all thumbnails to complete
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	thumbnailPaths := make(map[string]string)
	for result := range resultChan {
		if result.err != nil {
			return nil, fmt.Errorf("failed to create %s thumbnail: %w", result.resolution, result.err)
		}
		thumbnailPaths[result.resolution] = result.path
	}

	return thumbnailPaths, nil
}

// getResolutionConfig returns the configuration for a specific resolution
func (p *ParallelImageProcessor) getResolutionConfig(resolution string) (ResolutionConfig, error) {
	configs := GetResolutionConfigs()
	for _, config := range configs {
		if config.Name == resolution {
			return config, nil
		}
	}
	return ResolutionConfig{}, fmt.Errorf("unknown resolution: %s", resolution)
}

// storeImageInDatabase stores the processed image in the database
func (p *ParallelImageProcessor) storeImageInDatabase(job *ImageProcessingJob, metadata *Metadata, thumbnailPaths map[string]string) error {
	// Convert thumbnail paths to store format
	var storeThumbnails store.ImageThumbnails
	if thumbnailPaths != nil {
		storeThumbnails = store.ImageThumbnails{
			Resolution720p:  thumbnailPaths["720p"],
			Resolution1080p: thumbnailPaths["1080p"],
			Resolution1440p: thumbnailPaths["1440p"],
			Resolution4k:    thumbnailPaths["4k"],
			Fallback:        thumbnailPaths["fallback"],
		}
	}

	// Get next sequential ID
	nextID, err := p.store.GetSequentialIDManager().GetNextID()
	if err != nil {
		return fmt.Errorf("failed to get next ID: %w", err)
	}

	storeImage := &store.Image{
		ID:        nextID,
		Name:      job.UniqueName,
		Path:      filepath.Join(p.cacheDir, job.UniqueName),
		MediaType: "image", // Default to image type
		Metadata: store.ImageMetadata{
			Format:   metadata.Format,
			FileSize: 0,  // Will be calculated by AddImage
			Checksum: "", // Will be calculated by AddImage
		},
		Dimensions: store.ImageDimensions{
			Width:  int64(metadata.Width),
			Height: int64(metadata.Height),
		},
		Selection: store.ImageSelection{
			IsChecked:  true,
			IsSelected: false,
		},
		ImportInfo: store.ImageImportInfo{
			ImportedAt: time.Now(),
			Importer:   "parallel_processor",
		},
		Thumbnails: storeThumbnails,
	}

	imageStore := store.NewImageStore(p.store)
	return imageStore.AddImage(*storeImage)
}

// ExtractMetadataFromFile extracts metadata from a file path
func ExtractMetadataFromFile(filePath string) (*Metadata, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	return ExtractMetadata(data)
}
