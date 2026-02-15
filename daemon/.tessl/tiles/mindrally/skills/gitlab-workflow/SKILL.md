---
name: gitlab-workflow
description: GitLab best practices for merge requests, CI/CD pipelines, issue tracking, and DevOps workflows
---

# GitLab Workflow Best Practices

You are an expert in GitLab workflows, including merge requests, CI/CD pipelines, issue tracking, and DevOps best practices.

## Core Principles

- Use merge requests for all code changes with thorough review
- Implement comprehensive CI/CD pipelines with `.gitlab-ci.yml`
- Follow GitLab Flow or similar branching strategy
- Leverage GitLab's built-in DevOps features
- Maintain security through proper access controls and scanning

## Merge Request Best Practices

### Creating Effective Merge Requests

1. **Keep MRs small and focused**
   - One feature or fix per MR
   - Split large changes into smaller, reviewable chunks

2. **MR Title Convention**
   - Use conventional commits: `feat: add user authentication`
   - Include issue reference: `feat: add login page (#123)`

3. **MR Description Template**
   ```markdown
   ## Summary
   Brief description of what this MR accomplishes.

   ## Changes
   - List of specific changes

   ## Testing
   - How changes were tested
   - Test commands to run

   ## Checklist
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] Pipeline passes

   ## Related Issues
   Closes #123
   ```

4. **Link issues properly**
   - Use `Closes #123` to auto-close issues on merge
   - Use `Related to #123` for references without closing

### Draft Merge Requests

Use Draft MRs for work in progress:
- Prefix title with `Draft:` or use the Draft button
- Request early feedback on approach
- Convert to ready when complete

## CI/CD Pipeline Best Practices

### Basic Pipeline Structure

```yaml
stages:
  - build
  - test
  - security
  - deploy

variables:
  NODE_VERSION: "20"

default:
  image: node:${NODE_VERSION}
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 week

test:
  stage: test
  script:
    - npm ci
    - npm test
  coverage: '/Coverage: \d+\.\d+%/'

lint:
  stage: test
  script:
    - npm ci
    - npm run lint
  allow_failure: false
```

### Advanced Pipeline Features

#### Parallel Jobs

```yaml
test:
  stage: test
  parallel: 3
  script:
    - npm ci
    - npm test -- --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL
```

#### Conditional Jobs

```yaml
deploy:production:
  stage: deploy
  script:
    - ./deploy.sh production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
    - when: never
  environment:
    name: production
    url: https://example.com
```

#### Job Templates

```yaml
.test_template: &test_template
  stage: test
  before_script:
    - npm ci
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

unit_tests:
  <<: *test_template
  script:
    - npm run test:unit

integration_tests:
  <<: *test_template
  script:
    - npm run test:integration
  services:
    - postgres:15
```

### Security Scanning

```yaml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml
  - template: Security/Secret-Detection.gitlab-ci.yml
  - template: Security/Container-Scanning.gitlab-ci.yml

sast:
  stage: security

dependency_scanning:
  stage: security

secret_detection:
  stage: security
```

### Multi-Environment Deployments

```yaml
.deploy_template:
  stage: deploy
  script:
    - ./deploy.sh $ENVIRONMENT
  environment:
    name: $ENVIRONMENT
    url: https://$ENVIRONMENT.example.com

deploy:staging:
  extends: .deploy_template
  variables:
    ENVIRONMENT: staging
  rules:
    - if: $CI_COMMIT_BRANCH == "develop"

deploy:production:
  extends: .deploy_template
  variables:
    ENVIRONMENT: production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

## GitLab Flow

### Branch Strategy

1. **Main branch** - Production-ready code
2. **Feature branches** - Named `feature/description`
3. **Environment branches** (optional) - `staging`, `production`

### Workflow

1. Create feature branch from main
2. Develop and commit changes
3. Push and create merge request
4. Review, test, and iterate
5. Merge to main
6. Deploy automatically or manually

## Issue and Project Management

### Issue Templates

Create in `.gitlab/issue_templates/`:

**Bug.md:**
```markdown
## Description
Clear description of the bug.

## Steps to Reproduce
1. Step one
2. Step two

## Expected vs Actual Behavior
- Expected:
- Actual:

## Environment
- Browser:
- OS:
- Version:

/label ~bug ~needs-triage
```

**Feature.md:**
```markdown
## Problem Statement
Describe the problem this feature solves.

## Proposed Solution
Describe your proposed solution.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

/label ~feature ~needs-refinement
```

### Labels and Boards

Organize with labels:
- Type: `~bug`, `~feature`, `~documentation`
- Priority: `~priority::high`, `~priority::medium`, `~priority::low`
- Status: `~workflow::ready`, `~workflow::in-progress`, `~workflow::review`
- Team: `~team::backend`, `~team::frontend`

### Milestones

- Use milestones for sprints or releases
- Track progress with burndown charts
- Close milestones when complete

## Repository Settings

### Protected Branches

Configure for main:
- Allowed to merge: Maintainers
- Allowed to push: No one
- Require approval
- Require pipeline success

### Merge Request Settings

- Fast-forward merge or merge commit
- Squash commits option
- Delete source branch after merge
- Require all discussions resolved

## Security Best Practices

### CI/CD Variables

```yaml
# Use protected and masked variables
variables:
  DEPLOY_TOKEN:
    value: ""
    description: "Deployment authentication token"
```

Configure in Settings > CI/CD > Variables:
- Protected: Only available in protected branches
- Masked: Hidden in job logs

### Access Control

- Use groups for team permissions
- Follow least privilege principle
- Enable 2FA requirement
- Audit access regularly

### Compliance

Enable compliance features:
- Merge request approvals
- Push rules
- Audit events
- Compliance frameworks

## Auto DevOps

For quick setup, enable Auto DevOps:

```yaml
include:
  - template: Auto-DevOps.gitlab-ci.yml

variables:
  AUTO_DEVOPS_PLATFORM_TARGET: ECS
  POSTGRES_ENABLED: "true"
```

Features included:
- Auto Build
- Auto Test
- Auto Code Quality
- Auto SAST
- Auto Dependency Scanning
- Auto Container Scanning
- Auto Review Apps
- Auto Deploy
