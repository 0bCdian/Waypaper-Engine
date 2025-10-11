#!/bin/bash

# Monitor Migration Test Runner
# This script runs all tests for the monitor migration

set -e

echo "🧪 Monitor Migration Test Suite"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and capture results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "\n${BLUE}Running: $test_name${NC}"
    echo "Command: $test_command"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -f "daemon-go/go.mod" ]; then
        echo -e "${RED}Error: Not in the correct directory. Please run from waypaper-engine root.${NC}"
        exit 1
    fi
}

# Function to check if Go is available
check_go() {
    if ! command -v go &> /dev/null; then
        echo -e "${RED}Error: Go is not installed or not in PATH${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Go version: $(go version)${NC}"
}

# Function to check if test dependencies are available
check_dependencies() {
    echo -e "\n${BLUE}Checking dependencies...${NC}"
    
    # Check if testify is available
    if ! go list -m github.com/stretchr/testify &> /dev/null; then
        echo -e "${YELLOW}Installing testify...${NC}"
        go get github.com/stretchr/testify
    fi
    
    # Check if we can build the monitor package
    echo -e "${BLUE}Building monitor package...${NC}"
    if ! go build ./daemon-go/internal/monitor; then
        echo -e "${RED}Error: Cannot build monitor package${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Dependencies check passed${NC}"
}

# Function to run unit tests
run_unit_tests() {
    echo -e "\n${BLUE}🧪 Running Unit Tests${NC}"
    echo "====================="
    
    run_test "Monitor Model Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitor"
    run_test "Adapter Function Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorInfoToModel"
    run_test "Monitor Name Generation Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorNameGeneration"
    run_test "Monitor Equality Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorsEqual"
    run_test "Monitor Event Type Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorEventTypes"
    run_test "Monitor Manager Creation Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorManagerCreation"
    run_test "Monitor Manager Events Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorManagerEvents"
    run_test "Monitor Manager Poll Rate Tests" "go test -v ./daemon-go/internal/monitor -run TestMonitorManagerPollRate"
    run_test "Primary Monitor Tests" "go test -v ./daemon-go/internal/monitor -run TestGetPrimaryMonitor"
    run_test "Total Bounds Tests" "go test -v ./daemon-go/internal/monitor -run TestCalculateTotalBounds"
}

# Function to run integration tests
run_integration_tests() {
    echo -e "\n${BLUE}🔗 Running Integration Tests${NC}"
    echo "============================="
    
    run_test "Manager Wayland Integration" "go test -v ./daemon-go/internal/monitor -run TestManagerWithWayland"
    run_test "Manager Event Handling" "go test -v ./daemon-go/internal/monitor -run TestManagerEventHandling"
    run_test "Manager Fallback" "go test -v ./daemon-go/internal/monitor -run TestManagerFallback"
    run_test "Event Driven Updates" "go test -v ./daemon-go/internal/monitor -run TestEventDrivenUpdates"
    run_test "Manager Active Monitor" "go test -v ./daemon-go/internal/monitor -run TestManagerActiveMonitor"
    run_test "Manager Wallpaper Setting" "go test -v ./daemon-go/internal/monitor -run TestManagerWallpaperSetting"
    run_test "Manager Wallpaper All" "go test -v ./daemon-go/internal/monitor -run TestManagerWallpaperAll"
    run_test "Manager State Persistence" "go test -v ./daemon-go/internal/monitor -run TestManagerMonitorStatePersistence"
    run_test "Manager State Loading" "go test -v ./daemon-go/internal/monitor -run TestManagerMonitorStateLoading"
    run_test "Manager Restore Wallpapers" "go test -v ./daemon-go/internal/monitor -run TestManagerRestoreLastWallpapers"
    run_test "Manager Get Monitor Image Path" "go test -v ./daemon-go/internal/monitor -run TestManagerGetMonitorImagePath"
    run_test "Manager Error Handling" "go test -v ./daemon-go/internal/monitor -run TestManagerErrorHandling"
    run_test "Manager Concurrency" "go test -v ./daemon-go/internal/monitor -run TestManagerConcurrency"
}

# Function to run performance tests
run_performance_tests() {
    echo -e "\n${BLUE}⚡ Running Performance Tests${NC}"
    echo "============================="
    
    run_test "Monitor Detection Benchmark" "go test -bench=BenchmarkMonitorDetection -benchmem ./daemon-go/internal/monitor"
    run_test "Monitor Conversion Benchmark" "go test -bench=BenchmarkMonitorConversion -benchmem ./daemon-go/internal/monitor"
    run_test "Monitor Name Generation Benchmark" "go test -bench=BenchmarkMonitorNameGeneration -benchmem ./daemon-go/internal/monitor"
    run_test "Monitor Equality Benchmark" "go test -bench=BenchmarkMonitorEquality -benchmem ./daemon-go/internal/monitor"
    run_test "Monitor Manager Creation Benchmark" "go test -bench=BenchmarkMonitorManagerCreation -benchmem ./daemon-go/internal/monitor"
    run_test "Monitor Manager Operations Benchmark" "go test -bench=BenchmarkMonitorManagerOperations -benchmem ./daemon-go/internal/monitor"
    run_test "Manager Operations Benchmark" "go test -bench=BenchmarkManagerOperations -benchmem ./daemon-go/internal/monitor"
    run_test "Event System Benchmark" "go test -bench=BenchmarkEventSystem -benchmem ./daemon-go/internal/monitor"
    run_test "JSON Serialization Benchmark" "go test -bench=BenchmarkJSONSerialization -benchmem ./daemon-go/internal/monitor"
    run_test "Memory Usage Test" "go test -v ./daemon-go/internal/monitor -run TestMemoryUsage"
    run_test "Scalability Test" "go test -v ./daemon-go/internal/monitor -run TestScalability"
}

# Function to run compatibility tests
run_compatibility_tests() {
    echo -e "\n${BLUE}🔄 Running Compatibility Tests${NC}"
    echo "==============================="
    
    # Create test directories
    mkdir -p /tmp/images /tmp/thumbnails
    
    run_test "Backward Compatibility Test" "go test -v ./daemon-go/internal/monitor -run TestMonitorBackwardCompatibility"
    run_test "New Format Test" "go test -v ./daemon-go/internal/monitor -run TestMonitorNewFormat"
    run_test "Round Trip Conversion Test" "go test -v ./daemon-go/internal/monitor -run TestRoundTripConversion"
    
    # Cleanup test directories
    rm -rf /tmp/images /tmp/thumbnails
}

# Function to run all tests
run_all_tests() {
    echo -e "\n${BLUE}🚀 Running All Tests${NC}"
    echo "==================="
    
    run_test "All Monitor Tests" "go test -v ./daemon-go/internal/monitor"
}

# Function to generate test report
generate_report() {
    echo -e "\n${BLUE}📊 Test Report${NC}"
    echo "=============="
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Please check the output above.${NC}"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Monitor Migration Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --unit          Run unit tests only"
    echo "  -i, --integration   Run integration tests only"
    echo "  -p, --performance   Run performance tests only"
    echo "  -c, --compatibility Run compatibility tests only"
    echo "  -a, --all           Run all tests (default)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all tests"
    echo "  $0 --unit           # Run unit tests only"
    echo "  $0 --performance    # Run performance tests only"
}

# Main function
main() {
    # Parse command line arguments
    case "${1:-}" in
        -u|--unit)
            check_directory
            check_go
            check_dependencies
            run_unit_tests
            generate_report
            ;;
        -i|--integration)
            check_directory
            check_go
            check_dependencies
            run_integration_tests
            generate_report
            ;;
        -p|--performance)
            check_directory
            check_go
            check_dependencies
            run_performance_tests
            generate_report
            ;;
        -c|--compatibility)
            check_directory
            check_go
            check_dependencies
            run_compatibility_tests
            generate_report
            ;;
        -a|--all|"")
            check_directory
            check_go
            check_dependencies
            run_unit_tests
            run_integration_tests
            run_performance_tests
            run_compatibility_tests
            generate_report
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
