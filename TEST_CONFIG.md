# Monitor Migration Test Configuration

## Test Environment Setup

### Prerequisites
- Go 1.21 or later
- Wayland compositor (for integration tests)
- Testify package: `go get github.com/stretchr/testify`
- Wayland development libraries (for CGO)

### Test Categories

#### 1. Unit Tests
- **Model Tests**: Test Monitor struct updates and JSON serialization
- **Adapter Tests**: Test conversion between MonitorInfo and models.Monitor
- **Utility Tests**: Test monitor name generation, equality comparison, etc.
- **Event Tests**: Test monitor event types and handling

#### 2. Integration Tests
- **Manager Tests**: Test Manager integration with new MonitorManager
- **Event System Tests**: Test event-driven monitor updates
- **Wallpaper Tests**: Test wallpaper setting and management
- **State Persistence Tests**: Test monitor state saving/loading

#### 3. Performance Tests
- **Benchmark Tests**: Compare old vs new implementation performance
- **Memory Tests**: Test memory usage and leak detection
- **Scalability Tests**: Test performance with multiple monitors
- **Concurrency Tests**: Test thread safety

#### 4. Compatibility Tests
- **Backward Compatibility**: Test existing configurations work
- **JSON Migration**: Test JSON file format migration
- **API Compatibility**: Test existing API calls still work

## Test Execution

### Running All Tests
```bash
./test_monitor_migration.sh
```

### Running Specific Test Categories
```bash
# Unit tests only
./test_monitor_migration.sh --unit

# Integration tests only
./test_monitor_migration.sh --integration

# Performance tests only
./test_monitor_migration.sh --performance

# Compatibility tests only
./test_monitor_migration.sh --compatibility
```

### Running Individual Tests
```bash
# Run specific test
go test -v ./daemon-go/internal/monitor -run TestMonitorBackwardCompatibility

# Run benchmark
go test -bench=BenchmarkMonitorDetection -benchmem ./daemon-go/internal/monitor

# Run with coverage
go test -cover ./daemon-go/internal/monitor
```

## Test Data

### Sample Monitor Configurations
```json
{
  "monitors": [
    {
      "name": "HDMI-A-1",
      "make": "Samsung",
      "model": "U28E590D",
      "width": 1920,
      "height": 1080,
      "refreshRate": 60.0,
      "scale": 1,
      "transform": 0,
      "physicalWidth": 620,
      "physicalHeight": 340,
      "currentImage": "wallpaper1.jpg",
      "position": {"x": 0, "y": 0}
    }
  ]
}
```

### Test Images
- Create test images in `/tmp/images/` directory
- Use small test files for performance testing
- Test with different image formats (JPEG, PNG, WebP)

## Expected Results

### Performance Targets
- Monitor detection: 50% faster than old implementation
- Memory usage: Less than 10% increase
- Event response time: Under 100ms
- No memory leaks detected

### Quality Targets
- Test coverage: Above 90%
- All integration tests pass
- Performance benchmarks meet targets
- No critical bugs in testing

## Troubleshooting

### Common Issues

#### Wayland Not Available
- Set `WAYLAND_DISPLAY` environment variable
- Ensure running in Wayland session
- Install Wayland development libraries

#### CGO Compilation Issues
- Install Wayland development packages
- Ensure C compiler is available
- Check CGO_ENABLED=1

#### Test Dependencies Missing
- Run `go mod tidy` to update dependencies
- Install testify: `go get github.com/stretchr/testify`
- Check Go version compatibility

### Debug Mode
```bash
# Run tests with verbose output
go test -v ./daemon-go/internal/monitor

# Run tests with race detection
go test -race ./daemon-go/internal/monitor

# Run tests with coverage
go test -cover ./daemon-go/internal/monitor
```

## Continuous Integration

### GitHub Actions
```yaml
name: Monitor Migration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-go@v3
      with:
        go-version: '1.21'
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y libwayland-dev
    - name: Run tests
      run: ./test_monitor_migration.sh
```

### Local Development
```bash
# Pre-commit hook
#!/bin/bash
./test_monitor_migration.sh --unit
```

## Test Maintenance

### Adding New Tests
1. Create test function with `Test` prefix
2. Add test case to appropriate test file
3. Update test runner script if needed
4. Document test purpose and expected behavior

### Updating Tests
1. Update test data when models change
2. Adjust performance targets as needed
3. Update compatibility tests for new features
4. Maintain test coverage above 90%

### Test Documentation
- Document test purpose and scope
- Include sample data and expected results
- Update troubleshooting guide as needed
- Keep test configuration up to date
