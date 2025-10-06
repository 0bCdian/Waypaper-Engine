package image

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"sync"
	"time"

	"waypaper-engine/daemon-go/internal/errors"

	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
)

// BatchProcessingOptions holds configuration for batch image processing.
type BatchProcessingOptions struct {
	BatchSize        int                          // Number of images to process per batch
	WorkerCount      int                          // Number of parallel workers
	EnableGPUAccel   bool                         // Enable GPU acceleration if available
	Priority         Priority                     // Processing priority
	MemoryLimit      int64                        // Memory limit in bytes
	TempDir          string                       // Temporary directory for intermediate files
	ProgressCallback func(progress BatchProgress) // Progress callback
	ErrorHandling    ErrorHandling                // How to handle errors
	CleanupTempFiles bool                         // Whether to clean up temporary files
}

// Priority represents the processing priority level.
type Priority int

const (
	PriorityLow Priority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)

// ErrorHandling defines how batch processing handles errors.
type ErrorHandling int

const (
	ErrorHandlingStop ErrorHandling = iota
	ErrorHandlingContinue
	ErrorHandlingRetry
	ErrorHandlingSkip
)

// BatchProgress provides progress information for batch processing.
type BatchProgress struct {
	TotalImages     int           `json:"total_images"`
	ProcessedImages int           `json:"processed_images"`
	SuccessCount    int           `json:"success_count"`
	ErrorCount      int           `json:"error_count"`
	SkippedCount    int           `json:"skipped_count"`
	ElapsedTime     time.Duration `json:"elapsed_time"`
	EstimatedTime   time.Duration `json:"estimated_remaining_time"`
	PercentComplete float64       `json:"percent_complete"`
	CurrentPhase    string        `json:"current_phase"`
	Throughput      float64       `json:"throughput"` // Images per second
}

// BatchProcessingJob represents a single batch processing job.
type BatchProcessingJob struct {
	ID         string                  `json:"id"`
	Images     []BatchImageData        `json:"images"`
	Operations []BatchOperation        `json:"operations"`
	Options    BatchProcessingOptions  `json:"options"`
	StartTime  time.Time               `json:"start_time"`
	EndTime    time.Time               `json:"end_time"`
	Status     BatchStatus             `json:"status"`
	Results    []BatchProcessingResult `json:"results"`
	Error      error                   `json:"error"`
	Progress   BatchProgress           `json:"progress"`
}

// BatchImageData represents image data for batch processing.
type BatchImageData struct {
	ID       string    `json:"id"`
	Path     string    `json:"path"`
	Data     []byte    `json:"data,omitempty"`
	Priority Priority  `json:"priority"`
	Size     int64     `json:"size"`
	Format   string    `json:"format"`
	Metadata *Metadata `json:"metadata,omitempty"`
}

// BatchOperation represents an operation to perform in batch.
type BatchOperation struct {
	Type          string        `json:"type"`
	Parameters    interface{}   `json:"parameters"`
	Priority      Priority      `json:"priority"`
	ResourceUsage ResourceUsage `json:"resource_usage"`
}

// ResourceUsage describes resource requirements for an operation.
type ResourceUsage struct {
	CPUCores         int     `json:"cpu_cores"`
	MemoryMB         int     `json:"memory_mb"`
	GPUMemoryMB      int     `json:"gpu_memory_mb"`
	DiskSpaceMB      int     `json:"disk_space_mb"`
	EstimatedSeconds float64 `json:"estimated_seconds"`
}

// BatchStatus represents the status of a batch processing job.
type BatchStatus string

const (
	BatchStatusPending   BatchStatus = "pending"
	BatchStatusRunning   BatchStatus = "running"
	BatchStatusCompleted BatchStatus = "completed"
	BatchStatusFailed    BatchStatus = "failed"
	BatchStatusCancelled BatchStatus = "cancelled"
	BatchStatusPaused    BatchStatus = "paused"
)

// BatchProcessingResult represents the result of processing a single image.
type BatchProcessingResult struct {
	ImageID        string                 `json:"image_id"`
	Success        bool                   `json:"success"`
	Error          error                  `json:"error"`
	ProcessingTime time.Duration          `json:"processing_time"`
	OutputData     []byte                 `json:"output_data,omitempty"`
	OutputPath     string                 `json:"output_path,omitempty"`
	ResultMetadata map[string]interface{} `json:"result_metadata"`
}

// DefaultBatchProcessingOptions returns sensible defaults for batch processing.
func DefaultBatchProcessingOptions() BatchProcessingOptions {
	return BatchProcessingOptions{
		BatchSize:        20,
		WorkerCount:      4,
		EnableGPUAccel:   false,
		Priority:         PriorityNormal,
		MemoryLimit:      512 * 1024 * 1024, // 512MB
		TempDir:          "/tmp/waypaper_batch",
		ProgressCallback: nil,
		ErrorHandling:    ErrorHandlingContinue,
		CleanupTempFiles: true,
	}
}

// BatchProcessor handles batch image processing operations.
type BatchProcessor struct {
	mu            sync.RWMutex
	jobs          map[string]*BatchProcessingJob
	workerPool    chan struct{}
	runningJobs   map[string]chan struct{}
	logger        func(string, ...interface{})
	gpuAvailable  bool
	memoryMonitor MemoryMonitor
}

// MemoryMonitor tracks memory usage during batch processing.
type MemoryMonitor struct {
	maxMemory    int64
	currentUsage int64
	mu           sync.RWMutex
}

// NewBatchProcessor creates a new batch processor.
func NewBatchProcessor(logger func(string, ...interface{})) *BatchProcessor {
	return &BatchProcessor{
		jobs:        make(map[string]*BatchProcessingJob),
		runningJobs: make(map[string]chan struct{}),
		logger:      logger,
		memoryMonitor: MemoryMonitor{
			maxMemory: 1024 * 1024 * 1024, // 1GB default
		},
	}
}

// SetLogger sets a logger function.
func (bp *BatchProcessor) SetLogger(logger func(string, ...interface{})) {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	bp.logger = logger
}

// ProcessBatch starts a new batch processing job.
func (bp *BatchProcessor) ProcessBatch(images []BatchImageData, operations []BatchOperation, opts BatchProcessingOptions) (*BatchProcessingJob, error) {
	job := &BatchProcessingJob{
		ID:         generateBatchJobID(),
		Images:     images,
		Operations: operations,
		Options:    opts,
		Status:     BatchStatusPending,
		Progress:   BatchProgress{TotalImages: len(images)},
	}

	bp.mu.Lock()
	bp.jobs[job.ID] = job
	bp.mu.Unlock()

	// Start processing in background
	go bp.processJob(job)

	return job, nil
}

// processJob processes a batch job.
func (bp *BatchProcessor) processJob(job *BatchProcessingJob) error {
	bp.mu.Lock()
	stopChan := make(chan struct{})
	bp.runningJobs[job.ID] = stopChan
	bp.mu.Unlock()

	defer func() {
		bp.mu.Lock()
		delete(bp.runningJobs, job.ID)
		bp.mu.Unlock()
	}()

	// Initialize memory limiter
	_ = make(chan struct{}, job.Options.WorkerCount)

	startTime := time.Now()
	job.StartTime = startTime
	job.Status = BatchStatusRunning

	// Process images in parallel using worker pool
	var workerGroup sync.WaitGroup
	resultsChan := make(chan BatchProcessingResult, len(job.Images))

	// Start worker goroutines
	for i := 0; i < job.Options.WorkerCount; i++ {
		workerGroup.Add(1)
		go func(workerID int) {
			defer workerGroup.Done()
			bp.worker(workerID, job, resultsChan, stopChan)
		}(i)
	}

	// Collect results
	go bp.collectResults(job, resultsChan, &workerGroup)

	// Wait for completion
	workerGroup.Wait()
	close(resultsChan)

	job.EndTime = time.Now()
	job.Status = BatchStatusCompleted

	bp.mu.Lock()
	bp.runningJobs[job.ID] = stopChan
	bp.mu.Unlock()

	bp.logger("Completed batch processing job %s in %v", job.ID, time.Since(startTime))
	return nil
}

// worker processes images in a worker pool.
func (bp *BatchProcessor) worker(workerID int, job *BatchProcessingJob, resultsChan chan<- BatchProcessingResult, stopChan <-chan struct{}) {
	for _, img := range job.Images {
		select {
		case <-stopChan:
			return // Job cancelled
		default:
		}

		result := bp.processImage(img, job.Operations, job.Options)
		result.ProcessingTime = time.Since(job.StartTime)

		select {
		case resultsChan <- result:
		case <-stopChan:
			return
		}
	}
}

// processImage processes a single image with the given operations.
func (bp *BatchProcessor) processImage(img BatchImageData, operations []BatchOperation, opts BatchProcessingOptions) BatchProcessingResult {
	result := BatchProcessingResult{
		ImageID: img.ID,
	}

	startTime := time.Now()

	// Load image data if needed
	data := img.Data
	if len(data) == 0 && img.Path != "" {
		loadedData, err := os.ReadFile(img.Path)
		if err != nil {
			result.Error = fmt.Errorf("failed to load image: %w", err)
			return result
		}
		data = loadedData
	}

	// Apply operations sequentially
	for _, op := range operations {
		selectedData, err := bp.applyOperation(data, op)
		if err != nil {
			result.Error = fmt.Errorf("failed to apply operation %s: %w", op.Type, err)
			return result
		}
		data = selectedData
	}

	result.ProcessingTime = time.Since(startTime)
	result.Success = true
	result.OutputData = data

	// Update memory usage
	bp.updateMemoryUsage(len(data))

	return result
}

// applyOperation applies a single operation to image data.
func (bp *BatchProcessor) applyOperation(data []byte, op BatchOperation) ([]byte, error) {
	switch op.Type {
	case "resize":
		return bp.applyResizeOperation(data, op)
	case "optimize":
		return bp.applyOptimizationOperation(data, op)
	case "convert":
		return bp.applyConversionOperation(data, op)
	case "thumbnail":
		return bp.applyThumbnailOperation(data, op)
	default:
		return nil, fmt.Errorf("unknown operation type: %s", op.Type)
	}
}

// applyResizeOperation applies resize operation.
func (bp *BatchProcessor) applyResizeOperation(data []byte, op BatchOperation) ([]byte, error) {
	// Extract resize parameters
	params, ok := op.Parameters.(map[string]interface{})
	if !ok {
		return nil, errors.New(errors.ImageError, "invalid resize parameters")
	}

	width, _ := params["width"].(int)
	height, _ := params["height"].(int)
	quality, _ := params["quality"].(int)
	format, _ := params["format"].(string)

	if quality == 0 {
		quality = 85
	}
	if format == "" {
		format = "jpeg"
	}

	opts := ResizeOptions{
		Width:   width,
		Height:  height,
		Quality: quality,
		Format:  format,
		Filter:  imaging.Lanczos,
	}

	return Resize(data, opts)
}

// applyOptimizationOperation applies optimization.
func (bp *BatchProcessor) applyOptimizationOperation(data []byte, op BatchOperation) ([]byte, error) {
	params, ok := op.Parameters.(map[string]interface{})
	if !ok {
		return nil, errors.New(errors.ImageError, "invalid optimization parameters")
	}

	format, _ := params["format"].(string)
	quality, _ := params["quality"].(int)
	profile, _ := params["profile"].(string)

	if format == "" {
		format = "jpeg"
	}
	if quality == 0 {
		quality = 85
	}

	var opts OptimizationOptions
	if profile != "" {
		opts = GetOptimizationProfile(OptimizationProfile(profile))
	} else {
		opts = DefaultOptimizationOptions()
	}

	opts.Format = format
	opts.Quality = quality

	return OptimizeImage(data, opts)
}

// applyConversionOperation applies format conversion.
func (bp *BatchProcessor) applyConversionOperation(data []byte, op BatchOperation) ([]byte, error) {
	params, ok := op.Parameters.(map[string]interface{})
	if !ok {
		return nil, errors.New(errors.ImageError, "invalid conversion parameters")
	}

	format, _ := params["format"].(string)
	quality, _ := params["quality"].(int)
	lossless, _ := params["lossless"].(bool)

	if format == "" {
		return nil, errors.New(errors.ImageError, "format parameter required")
	}

	if format == "webp" {
		opts := DefaultWebPConversionOptions()
		if quality > 0 {
			opts.Quality = quality
		}
		opts.Lossless = lossless
		return ConvertToWebP(data, opts)
	}

	if quality == 0 {
		quality = 85
	}

	return ConvertFormat(data, format, quality)
}

// applyThumbnailOperation applies thumbnail generation.
func (bp *BatchProcessor) applyThumbnailOperation(data []byte, op BatchOperation) ([]byte, error) {
	params, ok := op.Parameters.(map[string]interface{})
	if !ok {
		return nil, errors.New(errors.ImageError, "invalid thumbnail parameters")
	}

	options := DefaultThumbnailOptions()
	options.Width, _ = params["width"].(int)
	options.Height, _ = params["height"].(int)
	if options.Width == 0 || options.Height == 0 {
		options.Width, options.Height = 300, 200 // Default thumbnail size
	}
	options.Quality, _ = params["quality"].(int)
	if options.Quality == 0 {
		options.Quality = 60 // Default thumbnail quality
	}

	// Generate thumbnail in memory
	return generateThumbnailBytes(data, options)
}

// collectResults collects processing results and updates job progress.
func (bp *BatchProcessor) collectResults(job *BatchProcessingJob, resultsChan <-chan BatchProcessingResult, workerGroup *sync.WaitGroup) {
	for result := range resultsChan {
		job.Results = append(job.Results, result)

		switch {
		case result.Success:
			job.Progress.SuccessCount++
		case result.Error != nil:
			job.Progress.ErrorCount++
		default:
			job.Progress.SkippedCount++
		}

		job.Progress.ProcessedImages++
		job.Progress.PercentComplete = float64(job.Progress.ProcessedImages) / float64(job.Progress.TotalImages) * 100

		// Update throughput calculation
		elapsed := time.Since(job.StartTime)
		if elapsed.Seconds() > 0 {
			job.Progress.Throughput = float64(job.Progress.ProcessedImages) / elapsed.Seconds()
		}

		// Estimate remaining time
		if job.Progress.Throughput > 0 {
			remaining := job.Progress.TotalImages - job.Progress.ProcessedImages
			job.Progress.EstimatedTime = time.Duration(float64(remaining)/job.Progress.Throughput) * time.Second
		}

		// Call progress callback if present
		if job.Options.ProgressCallback != nil {
			job.Options.ProgressCallback(job.Progress)
		}
	}
}

// cancelJob cancels a running batch job.
func (bp *BatchProcessor) cancelJob(jobID string) error {
	bp.mu.Lock()
	defer bp.mu.Unlock()

	job, exists := bp.jobs[jobID]
	if !exists {
		return fmt.Errorf("job not found: %s", jobID)
	}

	if stopChan, running := bp.runningJobs[jobID]; running {
		close(stopChan)
		job.Status = BatchStatusCancelled
	}

	return nil
}

// GetJobStatus retrieves the status of a batch job.
func (bp *BatchProcessor) GetJobStatus(jobID string) (*BatchProcessingJob, error) {
	bp.mu.RLock()
	defer bp.mu.RUnlock()

	job, exists := bp.jobs[jobID]
	if !exists {
		return nil, fmt.Errorf("job not found: %s", jobID)
	}

	// Return a copy to avoid race conditions
	copy := *job
	return &copy, nil
}

// GetActiveJobs returns a list of currently active jobs.
func (bp *BatchProcessor) GetActiveJobs() []*BatchProcessingJob {
	bp.mu.RLock()
	defer bp.mu.RUnlock()

	var activeJobs []*BatchProcessingJob
	for _, job := range bp.jobs {
		if job.Status == BatchStatusRunning || job.Status == BatchStatusPending {
			jobCopy := *job
			activeJobs = append(activeJobs, &jobCopy)
		}
	}

	return activeJobs
}

// Helper functions

func generateBatchJobID() string {
	return fmt.Sprintf("batch_%d", time.Now().UnixNano())
}

func (bp *BatchProcessor) updateMemoryUsage(size int) {
	bp.memoryMonitor.mu.Lock()
	defer bp.memoryMonitor.mu.Unlock()
	bp.memoryMonitor.currentUsage += int64(size)
}

func (bp *BatchProcessor) checkMemoryLimit() bool {
	bp.memoryMonitor.mu.RLock()
	defer bp.memoryMonitor.mu.RUnlock()
	return bp.memoryMonitor.currentUsage < bp.memoryMonitor.maxMemory
}

// SetMemoryLimit sets the memory limit for batch processing.
func (bp *BatchProcessor) SetMemoryLimit(limit int64) {
	bp.memoryMonitor.mu.Lock()
	defer bp.memoryMonitor.mu.Unlock()
	bp.memoryMonitor.maxMemory = limit
}

// generateThumbnailBytes generates a thumbnail in memory.
func generateThumbnailBytes(data []byte, opts ThumbnailOptions) ([]byte, error) {
	// Decode the input image
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	// Resize with "cover" fit (crop to fill the dimensions)
	resizedImg := imaging.Fill(img, opts.Width, opts.Height, imaging.Center, imaging.Lanczos)

	// Encode the thumbnail
	var buf bytes.Buffer
	switch opts.Format {
	case "webp":
		err = webp.Encode(&buf, resizedImg, &webp.Options{Quality: float32(opts.Quality)})
	case "jpeg":
		err = jpeg.Encode(&buf, resizedImg, &jpeg.Options{Quality: opts.Quality})
	case "png":
		err = png.Encode(&buf, resizedImg)
	default:
		err = fmt.Errorf("unsupported format: %s", opts.Format)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	return buf.Bytes(), nil
}

// Helper functions
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
