---
name: git-workflow
description: Git conventions and workflow guidelines using Conventional Commits, branching strategies, and best practices for version control
---

# Git Workflow Best Practices

You are an expert in Git version control, following industry best practices for commits, branching, and collaboration workflows.

## Core Principles

- Write clear, atomic commits that address single logical changes
- Follow Conventional Commits specification for all commit messages
- Use feature branches to isolate changes and enable easier code review
- Keep branches short-lived and regularly sync with main branch
- Never commit directly to main/master branch

## Conventional Commits Format

Use the following format for all commit messages:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- `feat`: A new feature (correlates with MINOR in SemVer)
- `fix`: A bug fix (correlates with PATCH in SemVer)
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Commit Message Guidelines

- Use lowercase letters in the entire body of the commit message
- Keep the commit message title under 60 characters
- Use imperative mood: "Add feature" not "Added feature"
- Explain the *why* behind the change, not just *what* was changed
- Reference related issues or tickets in the footer

### Examples

```
feat(auth): add OAuth2 authentication support

Implement OAuth2 flow for Google and GitHub providers.
This allows users to sign in with their existing accounts.

Closes #123
```

```
fix(api): handle null response from external service

The external API sometimes returns null instead of an empty array.
Added null check to prevent TypeError in downstream processing.

Fixes #456
```

## Branching Strategy

### Branch Naming Conventions

Use descriptive, kebab-case branch names with prefixes:

- `feature/` - New features (e.g., `feature/user-authentication`)
- `bugfix/` - Bug fixes (e.g., `bugfix/login-redirect-loop`)
- `hotfix/` - Urgent production fixes (e.g., `hotfix/security-patch`)
- `release/` - Release preparation (e.g., `release/v2.1.0`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/database-layer`)

### Workflow Guidelines

1. **Create feature branches from main/develop**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/new-feature
   ```

2. **Keep branches up-to-date**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

3. **Make atomic commits**
   - Each commit should be a single, logical change
   - Commit early and often when code is in a stable state
   - Avoid mixing unrelated changes in a single commit

4. **Before merging**
   - Ensure all tests pass
   - Squash fixup commits if needed
   - Rebase onto latest main to resolve conflicts

5. **Clean up after merge**
   ```bash
   git branch -d feature/new-feature
   git push origin --delete feature/new-feature
   ```

## Git Configuration Best Practices

### Useful Aliases

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --decorate"
```

### Recommended Settings

```bash
git config --global pull.rebase true
git config --global fetch.prune true
git config --global diff.colorMoved zebra
```

## Collaboration Guidelines

### Code Review Process

1. Create small, focused pull requests
2. Write clear PR descriptions explaining the changes
3. Link related issues and documentation
4. Request reviews from appropriate team members
5. Address feedback promptly and professionally
6. Squash commits when merging if history is messy

### Merge Strategies

- **Merge commit**: Preserves full history, good for feature branches
- **Squash and merge**: Combines all commits into one, cleaner main history
- **Rebase and merge**: Linear history, requires clean commit history

### Conflict Resolution

1. Pull latest changes from target branch
2. Resolve conflicts locally
3. Test thoroughly after resolution
4. Commit with clear message explaining resolution

## Security Best Practices

- Never commit sensitive data (passwords, API keys, tokens)
- Use `.gitignore` to exclude sensitive files
- Review diffs before committing
- Use signed commits for verified authorship
- Rotate any accidentally committed secrets immediately

## Integration with Semantic Versioning

Conventional Commits integrate well with semantic versioning:

- `feat`: triggers a MINOR version bump
- `fix`: triggers a PATCH version bump
- `BREAKING CHANGE`: triggers a MAJOR version bump

This enables automated version determination and changelog generation.
