---
name: github-workflow
description: GitHub best practices for pull requests, code reviews, issues, Actions workflows, and repository management
---

# GitHub Workflow Best Practices

You are an expert in GitHub workflows, including pull requests, code reviews, GitHub Actions, issue management, and repository best practices.

## Core Principles

- Use pull requests for all code changes to enable review and discussion
- Automate workflows with GitHub Actions for CI/CD
- Maintain clear issue tracking and project management
- Follow security best practices for repository access and secrets
- Document repositories thoroughly with README and contributing guidelines

## Pull Request Best Practices

### Creating Effective Pull Requests

1. **Keep PRs small and focused**
   - One feature or fix per PR
   - Aim for under 400 lines of changes when possible
   - Split large features into stacked PRs

2. **Write descriptive PR titles**
   - Use conventional commit style: `feat: add user authentication`
   - Be specific about what the PR accomplishes

3. **PR Description Template**
   ```markdown
   ## Summary
   Brief description of changes and motivation.

   ## Changes
   - Bullet points of specific changes made

   ## Testing
   - How the changes were tested
   - Steps to reproduce/verify

   ## Related Issues
   Closes #123

   ## Screenshots (if applicable)
   ```

4. **Link related issues**
   - Use `Closes #123` or `Fixes #123` to auto-close issues
   - Reference related issues with `#123`

### Stacked Pull Requests

For complex features, use stacked PRs:

1. Create a base feature branch
2. Create subsequent PRs that build on each other
3. Merge in order from base to top
4. Keep each PR small and reviewable

## Code Review Guidelines

### As a Reviewer

1. **Review promptly** - Respond within 24 hours when possible
2. **Be constructive** - Focus on improvement, not criticism
3. **Ask questions** - Seek to understand before suggesting changes
4. **Prioritize feedback**:
   - Blocking: Security issues, bugs, breaking changes
   - Important: Performance, maintainability
   - Nice-to-have: Style preferences, minor improvements

### Comment Conventions

Use prefixes to indicate comment severity:

- `blocking:` Must be addressed before merge
- `suggestion:` Recommended improvement
- `question:` Seeking clarification
- `nit:` Minor style or preference (optional to address)
- `praise:` Positive feedback on good code

### Example Review Comments

```
blocking: This SQL query is vulnerable to injection.
Please use parameterized queries.

suggestion: Consider extracting this logic into a separate
function for better testability.

nit: Prefer `const` over `let` here since this value
is never reassigned.
```

### Approval Criteria

- All blocking comments addressed
- Tests pass
- CI/CD checks pass
- At least one approval from code owner

## GitHub Actions

### Workflow Best Practices

1. **Use workflow templates**
   ```yaml
   name: CI
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]

   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - name: Setup Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '20'
             cache: 'npm'
         - run: npm ci
         - run: npm test
   ```

2. **Cache dependencies**
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
   ```

3. **Use reusable workflows**
   ```yaml
   jobs:
     call-workflow:
       uses: ./.github/workflows/reusable.yml
       with:
         environment: production
       secrets: inherit
   ```

4. **Set appropriate timeouts**
   ```yaml
   jobs:
     build:
       timeout-minutes: 10
   ```

### Security in Actions

- Use `secrets` for sensitive data
- Pin action versions with SHA: `uses: actions/checkout@a5ac7e51b41094c92402da3b24376905380afc29`
- Limit `GITHUB_TOKEN` permissions
- Review third-party actions before use

```yaml
permissions:
  contents: read
  pull-requests: write
```

## Issue Management

### Issue Templates

Create `.github/ISSUE_TEMPLATE/` with templates:

**Bug Report:**
```markdown
---
name: Bug Report
about: Report a bug
labels: bug
---

## Description
Clear description of the bug.

## Steps to Reproduce
1. Step one
2. Step two

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS:
- Browser:
- Version:
```

**Feature Request:**
```markdown
---
name: Feature Request
about: Suggest a new feature
labels: enhancement
---

## Problem
Describe the problem this feature would solve.

## Proposed Solution
Describe your proposed solution.

## Alternatives Considered
Other approaches you've considered.
```

### Labels

Use consistent labels:
- `bug`, `enhancement`, `documentation`
- `good first issue`, `help wanted`
- `priority: high`, `priority: medium`, `priority: low`
- `status: in progress`, `status: blocked`

## Repository Management

### Branch Protection Rules

Configure for main branch:
- Require pull request reviews
- Require status checks to pass
- Require conversation resolution
- Require signed commits (optional)
- Restrict force pushes

### CODEOWNERS File

```
# .github/CODEOWNERS
* @default-team
/docs/ @docs-team
/src/api/ @backend-team
*.js @frontend-team
```

### Security Best Practices

1. **Enable security features**
   - Dependabot alerts and updates
   - Code scanning with CodeQL
   - Secret scanning

2. **Manage secrets properly**
   - Use repository or organization secrets
   - Rotate secrets regularly
   - Never commit secrets to code

3. **Access control**
   - Use teams for permissions
   - Follow principle of least privilege
   - Audit access regularly

## Automation Recommendations

### Auto-merge for Dependabot

```yaml
name: Dependabot auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  dependabot:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Auto-merge minor updates
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Release Automation

Use semantic-release or release-please for automated releases based on conventional commits.
