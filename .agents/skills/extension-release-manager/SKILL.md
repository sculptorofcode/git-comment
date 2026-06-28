---
name: extension-release-manager
description: >-
  Automates releasing new versions of the extension. It bumps the version in package.json,
  updates CHANGELOG.md with release notes, and packages the extension to build/*.vsix.
---

# Extension Release Manager

## Overview
This skill automates the local release process of the extension. It updates package.json version field, appends new entries to CHANGELOG.md, compiles the code, builds/packages the extension, and optionally manages git release commit and tag creation.

## Dependencies
- None

## Quick Start
To package a patch release of the extension:
```bash
npm run release -- patch --notes "Fix Gemini status 503 errors and optimize large git diffs."
```

## Utility Scripts
This skill uses the `scripts/release.js` utility script.

### Usage
```bash
node scripts/release.js <patch | minor | major> [--notes "<summary>"] [--git]
```

### Arguments
- **Position 1 (Required)**: Bumps version using semantic versioning. Can be:
  - `patch` (bumps `X.Y.Z` to `X.Y.Z+1`)
  - `minor` (bumps `X.Y.Z` to `X.Y.Z+1.0`)
  - `major` (bumps `X.Y.Z` to `X+1.0.0`)
- **`--notes "<summary>"` (Optional)**: Set the release notes/summary to insert in the `CHANGELOG.md`. Defaults to `"Minor updates and bug fixes."` if not provided.
- **`--git` (Optional)**: Automatically runs `git add package.json CHANGELOG.md`, commits the change, and tags the commit as `v<new_version>`.

## Common Mistakes
- **Running in dirty workspace**: Ensure you have verified and tested all staged changes before running the release command.
- **Wrong bump type**: Ensure you specify the correct bump level (patch for fixes, minor for features, major for breaking changes).
