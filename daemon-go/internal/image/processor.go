
package image

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"waypaper-engine/daemon-go/internal/errors"
)

// Processor handles image processing tasks.
type Processor struct {
	workerPoolSize int
	jobs           chan *Job
	results        chan *Result
	logger         *slog.Logger
	cache          *Cache
}

// Job represents an image processing job.
type Job struct {
	ID   string
	Data []byte
	Type JobType
	Opts interface{}
}

// JobType defines the type of image processing job.
type JobType string

const (
	JobTypeResize   JobType = "resize"
	JobTypeMetadata JobType = "metadata"
	JobTypeMonitor  JobType = "monitor"
)

// Result represents the result of an image processing job.
type Result struct {
	ID    string
	Data  []byte
	Meta  *Metadata
	Error error
}

// NewProcessor creates a new image processor.
func NewProcessor(workerPoolSize int, cacheSize int, logger *slog.Logger) *Processor {
	return &Processor{
		workerPoolSize: workerPoolSize,
		jobs:           make(chan *Job),
		results:        make(chan *Result),
		logger:         logger,
		cache:          NewCache(cacheSize),
	}
}

// Start starts the image processing worker pool.
func (p *Processor) Start(ctx context.Context) {
	for i := 0; i < p.workerPoolSize; i++ {
		go p.worker(ctx, i)
	}
	go p.collectResults(ctx)
}

// SubmitJob submits a new image processing job.
func (p *Processor) SubmitJob(job *Job) {
	p.jobs <- job
}

// GetResults returns the channel for job results.
func (p *Processor) GetResults() <-chan *Result {
	return p.results
}

func (p *Processor) worker(ctx context.Context, id int) {
	for {
		select {
		case <-ctx.Done():
			p.logger.Info("worker shutting down", "worker_id", id)
			return
		case job := <-p.jobs:
			p.processJob(job)
		}
	}
}

func (p *Processor) processJob(job *Job) {
	result := &Result{ID: job.ID}

	// Check cache first
	if cachedData, found := p.cache.Get(job.ID); found {
		result.Data = cachedData
		p.results <- result
		return
	}

	switch job.Type {
	case JobTypeResize:
		opts, ok := job.Opts.(ResizeOptions)
		if !ok {
			result.Error = errors.New(errors.ImageError, "invalid resize options")
			p.results <- result
			return
		}
		data, err := Resize(job.Data, opts)
		if err != nil {
			result.Error = errors.New(errors.ImageError, fmt.Sprintf("failed to resize image: %v", err))
		} else {
			result.Data = data
			p.cache.Add(job.ID, data)
		}
	case JobTypeMetadata:
		meta, err := ExtractMetadata(job.Data)
		if err != nil {
			result.Error = errors.New(errors.ImageError, fmt.Sprintf("failed to extract metadata: %v", err))
		} else {
			result.Meta = meta
		}
	case JobTypeMonitor:
		// This job type would involve more complex processing and might return multiple images
		// For simplicity, we'll just pass the original data for now.
		result.Data = job.Data
	default:
		result.Error = errors.New(errors.ImageError, "unknown job type")
	}

	p.results <- result
}

func (p *Processor) collectResults(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			p.logger.Info("result collector shutting down")
			return
		case <-p.results:
			// Results are collected by the caller of SubmitJob via GetResults()
			// This goroutine just keeps the channel clear.
		}
	}
}

// Cache implements a simple LRU cache for image data.
type Cache struct {
	mu    sync.Mutex
	data  map[string][]byte
	order []string
	limit int
}

// NewCache creates a new cache with the given size limit.
func NewCache(limit int) *Cache {
	return &Cache{
		data:  make(map[string][]byte),
		order: make([]string, 0, limit),
		limit: limit,
	}
}

// Add adds an item to the cache.
func (c *Cache) Add(key string, value []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if _, ok := c.data[key]; ok {
		// Item already exists, move to front
		c.moveToFront(key)
		return
	}

	c.data[key] = value
	c.order = append([]string{key}, c.order...)

	if len(c.order) > c.limit {
		// Evict LRU item
		delete(c.data, c.order[len(c.order)-1])
		c.order = c.order[:len(c.order)-1]
	}
}

// Get retrieves an item from the cache.
func (c *Cache) Get(key string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	value, ok := c.data[key]
	if ok {
		c.moveToFront(key)
	}
	return value, ok
}

func (c *Cache) moveToFront(key string) {
	for i, k := range c.order {
		if k == key {
			c.order = append(c.order[:i], c.order[i+1:]...)
			break
		}
	}
	c.order = append([]string{key}, c.order...)
}
