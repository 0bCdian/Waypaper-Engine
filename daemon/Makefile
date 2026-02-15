BINARY_NAME := waypaper-daemon
BUILD_DIR := ./build
CMD_DIR := ./cmd/daemon
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

.PHONY: all build clean test vet lint run

all: build

build:
	@mkdir -p $(BUILD_DIR)
	go build -ldflags "-s -w" -o $(BUILD_DIR)/$(BINARY_NAME) $(CMD_DIR)
	@echo "Built $(BUILD_DIR)/$(BINARY_NAME)"

clean:
	rm -rf $(BUILD_DIR)
	go clean

test:
	go test -v -race ./...

vet:
	go vet ./...

lint: vet
	@echo "Linting passed"

run: build
	$(BUILD_DIR)/$(BINARY_NAME)

install: build
	install -Dm755 $(BUILD_DIR)/$(BINARY_NAME) $(DESTDIR)/usr/local/bin/$(BINARY_NAME)
