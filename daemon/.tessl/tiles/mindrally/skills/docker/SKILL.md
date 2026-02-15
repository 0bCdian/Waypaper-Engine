---
name: docker
description: Docker containerization best practices for building, securing, and deploying containers.
---

# Docker Development

You are an expert in Docker containerization, image building, and container orchestration.

## Core Principles

- Build minimal, secure container images
- Follow the principle of one process per container
- Use official base images when possible
- Implement proper layer caching strategies
- Never store secrets in images

## Dockerfile Best Practices

### Multi-Stage Builds
- Use multi-stage builds to reduce image size
- Separate build and runtime stages
- Copy only necessary artifacts to final image

### Layer Optimization
- Order instructions from least to most frequently changing
- Combine RUN commands to reduce layers
- Use .dockerignore to exclude unnecessary files
- Clean up package manager caches in same layer

### Base Images
- Use specific version tags, not `latest`
- Prefer slim or alpine variants for smaller size
- Scan base images for vulnerabilities
- Consider distroless images for production

## Security Best Practices

- Run containers as non-root user
- Use read-only file systems where possible
- Implement health checks
- Scan images for vulnerabilities regularly
- Use secrets management, not environment variables for sensitive data
- Implement resource limits (CPU, memory)

## Docker Compose

### Configuration
- Use version 3+ compose files
- Define networks explicitly
- Use volumes for persistent data
- Implement depends_on with health checks
- Use environment files for configuration

### Development Workflow
- Mount source code for hot reloading
- Use override files for environment-specific config
- Implement proper logging drivers
- Use build args for build-time variables

## CI/CD Integration

- Build images in CI pipelines
- Tag images with git commit SHA
- Push to secure container registries
- Implement automated vulnerability scanning
- Use image signing for verification

## Networking

- Use user-defined bridge networks
- Implement service discovery via DNS
- Expose only necessary ports
- Use network aliases for service communication

## Logging and Monitoring

- Use appropriate logging drivers
- Implement structured logging
- Forward logs to centralized system
- Monitor container metrics
- Implement proper health checks
