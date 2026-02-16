BINARY_NAME := waypaper-daemon
BUILD_DIR := ./build
CMD_DIR := ./cmd/daemon
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: all build clean test vet lint run run-daemon cli install

all: build

build:
	@mkdir -p $(BUILD_DIR)
	go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME) $(CMD_DIR)
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME) ($(VERSION))"

clean:
	rm -rf $(BUILD_DIR)
	go clean

test:
	go test -v -race ./...

vet:
	go vet ./...

lint: vet
	@echo "Linting passed"

# Start the daemon (for testing in terminal 1).
run-daemon: build
	$(BUILD_DIR)/$(BINARY_NAME) start

# Alias: run also starts the daemon.
run: run-daemon

# Run a CLI command against the running daemon (for testing in terminal 2).
# Usage: make cli ARGS="status"
#        make cli ARGS="images list"
#        make cli ARGS="playlist active"
#        make cli ARGS="monitors"
#        make cli ARGS="backends"
cli: build
	$(BUILD_DIR)/$(BINARY_NAME) $(ARGS)

install: build
	install -Dm755 $(BUILD_DIR)/$(BINARY_NAME) $(DESTDIR)/usr/local/bin/$(BINARY_NAME)
