---
name: ci-cd-best-practices
description: CI/CD best practices for building automated pipelines, deployment strategies, testing, and DevOps workflows across platforms
---

# CI/CD Best Practices

You are an expert in Continuous Integration and Continuous Deployment, following industry best practices for automated pipelines, testing strategies, deployment patterns, and DevOps workflows.

## Core Principles

- Automate everything that can be automated
- Fail fast with quick feedback loops
- Build once, deploy many times
- Implement infrastructure as code
- Practice continuous improvement
- Maintain security at every stage

## Pipeline Design

### Pipeline Stages

A typical CI/CD pipeline includes these stages:

```
Build -> Test -> Security -> Deploy (Staging) -> Deploy (Production)
```

#### 1. Build Stage

```yaml
build:
  stage: build
  script:
    - npm ci --prefer-offline
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 day
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/
```

Best practices:
- Use dependency caching to speed up builds
- Generate build artifacts for downstream stages
- Pin dependency versions for reproducibility
- Use multi-stage Docker builds for smaller images

#### 2. Test Stage

```yaml
test:
  stage: test
  parallel:
    matrix:
      - TEST_TYPE: [unit, integration, e2e]
  script:
    - npm run test:${TEST_TYPE}
  coverage: '/Coverage: \d+\.\d+%/'
  artifacts:
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

Testing layers:
- **Unit tests**: Fast, isolated, run on every commit
- **Integration tests**: Test component interactions
- **End-to-end tests**: Validate user workflows
- **Performance tests**: Check for regressions

#### 3. Security Stage

```yaml
security:
  stage: security
  parallel:
    matrix:
      - SCAN_TYPE: [sast, dependency, secrets]
  script:
    - ./security-scan.sh ${SCAN_TYPE}
  allow_failure: false
```

Security scanning types:
- **SAST**: Static Application Security Testing
- **DAST**: Dynamic Application Security Testing
- **Dependency scanning**: Check for vulnerable packages
- **Secret detection**: Find leaked credentials
- **Container scanning**: Analyze Docker images

#### 4. Deploy Stage

```yaml
deploy:staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.example.com
  script:
    - ./deploy.sh staging
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"

deploy:production:
  stage: deploy
  environment:
    name: production
    url: https://example.com
  script:
    - ./deploy.sh production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

## Deployment Strategies

### Blue-Green Deployment

Maintain two identical environments:

```yaml
deploy:blue-green:
  script:
    - ./deploy-to-inactive.sh
    - ./run-smoke-tests.sh
    - ./switch-traffic.sh
    - ./cleanup-old-environment.sh
```

Benefits:
- Zero-downtime deployments
- Easy rollback by switching traffic back
- Full testing in production-like environment

### Canary Deployment

Gradually roll out to subset of users:

```yaml
deploy:canary:
  script:
    - ./deploy-canary.sh --percentage=5
    - ./monitor-metrics.sh --duration=30m
    - ./deploy-canary.sh --percentage=25
    - ./monitor-metrics.sh --duration=30m
    - ./deploy-canary.sh --percentage=100
```

Canary stages:
1. Deploy to 5% of traffic
2. Monitor error rates and latency
3. Gradually increase if metrics are healthy
4. Full rollout or rollback based on data

### Rolling Deployment

Update instances incrementally:

```yaml
deploy:rolling:
  script:
    - kubectl rollout restart deployment/app
    - kubectl rollout status deployment/app --timeout=5m
```

Configuration:
- Set `maxUnavailable` and `maxSurge`
- Health checks determine rollout pace
- Automatic rollback on failure

### Feature Flags

Decouple deployment from release:

```javascript
// Feature flag implementation
if (featureFlags.isEnabled('new-checkout')) {
  return <NewCheckout />;
} else {
  return <LegacyCheckout />;
}
```

Benefits:
- Deploy disabled features to production
- Gradual feature rollout
- A/B testing capabilities
- Quick feature disable without deployment

## Environment Management

### Environment Hierarchy

```
Development -> Testing -> Staging -> Production
```

Each environment should:
- Mirror production as closely as possible
- Have isolated data and secrets
- Use infrastructure as code

### Environment Variables

```yaml
variables:
  # Global variables
  APP_NAME: my-app

# Environment-specific
.staging:
  variables:
    ENV: staging
    API_URL: https://api.staging.example.com

.production:
  variables:
    ENV: production
    API_URL: https://api.example.com
```

Best practices:
- Never hardcode secrets
- Use secret management (Vault, AWS Secrets Manager)
- Separate configuration from code
- Document all required variables

### Infrastructure as Code

```hcl
# Terraform example
resource "aws_ecs_service" "app" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.environment == "production" ? 3 : 1

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }
}
```

## Testing Strategies

### Test Pyramid

```
        /\
       /  \      E2E Tests (Few)
      /----\
     /      \    Integration Tests (Some)
    /--------\
   /          \  Unit Tests (Many)
  --------------
```

### Test Parallelization

```yaml
test:
  parallel: 4
  script:
    - npm test -- --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

### Test Data Management

- Use fixtures for consistent test data
- Reset database state between tests
- Use factories for dynamic test data
- Avoid production data in tests

### Flaky Test Handling

```yaml
test:
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
```

Strategies:
- Quarantine flaky tests
- Add retry logic for known issues
- Investigate and fix root causes
- Track flaky test metrics

## Monitoring and Observability

### Pipeline Metrics

Track these metrics:
- **Lead time**: Commit to production duration
- **Deployment frequency**: How often you deploy
- **Change failure rate**: Percentage of failed deployments
- **Mean time to recovery**: Time to fix failures

### Health Checks

```yaml
deploy:
  script:
    - ./deploy.sh
    - ./wait-for-healthy.sh --timeout=300
    - ./run-smoke-tests.sh
```

Implement:
- Readiness probes
- Liveness probes
- Startup probes
- Smoke tests post-deployment

### Alerting

```yaml
notify:failure:
  stage: notify
  script:
    - ./send-alert.sh --channel=deployments --status=failed
  when: on_failure

notify:success:
  stage: notify
  script:
    - ./send-notification.sh --channel=deployments --status=success
  when: on_success
```

## Security in CI/CD

### Secrets Management

```yaml
# Use CI/CD secret variables
deploy:
  script:
    - echo "$DEPLOY_KEY" | base64 -d > deploy_key
    - chmod 600 deploy_key
    - ./deploy.sh
  after_script:
    - rm -f deploy_key
```

Best practices:
- Rotate secrets regularly
- Use short-lived credentials
- Audit secret access
- Never log secrets

### Pipeline Security

```yaml
# Restrict who can run production deploys
deploy:production:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
      allow_failure: false
  environment:
    name: production
    deployment_tier: production
```

Controls:
- Branch protection rules
- Required approvals
- Audit logging
- Signed commits

### Dependency Security

```yaml
dependency_check:
  script:
    - npm audit --audit-level=high
    - ./check-licenses.sh
  allow_failure: false
```

## Optimization Techniques

### Caching

```yaml
cache:
  key:
    files:
      - package-lock.json
  paths:
    - node_modules/
  policy: pull-push
```

Cache strategies:
- Cache dependencies between runs
- Use content-based cache keys
- Separate cache per branch
- Clean stale caches periodically

### Parallelization

```yaml
stages:
  - build
  - test
  - deploy

# Run tests in parallel
test:unit:
  stage: test
  script: npm run test:unit

test:integration:
  stage: test
  script: npm run test:integration

test:e2e:
  stage: test
  script: npm run test:e2e
```

### Artifact Management

```yaml
build:
  artifacts:
    paths:
      - dist/
    expire_in: 1 week
    when: on_success
```

Best practices:
- Set appropriate expiration
- Only store necessary artifacts
- Use artifact compression
- Clean up old artifacts

## Rollback Strategies

### Automatic Rollback

```yaml
deploy:
  script:
    - ./deploy.sh
    - ./health-check.sh || ./rollback.sh
```

### Manual Rollback

```yaml
rollback:
  stage: deploy
  when: manual
  script:
    - ./get-previous-version.sh
    - ./deploy.sh --version=$PREVIOUS_VERSION
```

### Database Rollbacks

- Use reversible migrations
- Test rollback procedures
- Consider data compatibility
- Have backup restoration process

## Documentation

### Pipeline Documentation

Document in your repository:
- Pipeline stages and their purpose
- Required environment variables
- Deployment procedures
- Troubleshooting guides
- Rollback procedures

### Runbooks

Create runbooks for:
- Deployment failures
- Rollback procedures
- Environment setup
- Incident response

## Continuous Improvement

### Metrics to Track

- Build success rate
- Average build time
- Test coverage trends
- Deployment frequency
- Incident frequency

### Regular Reviews

- Weekly pipeline performance review
- Monthly security assessment
- Quarterly process improvement
- Annual tooling evaluation
