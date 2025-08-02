# Release Process for Hydra Fork

This document explains how to create releases for your Hydra fork with local backup functionality.

## Overview

The release process is automated through GitHub Actions. When you create a version tag, it will:

1. Build Windows portable executable (.exe)
2. Build Linux packages (.deb, .AppImage, etc.)
3. Create a GitHub release with all build artifacts
4. Upload the files for users to download

## Prerequisites

1. Your fork must have GitHub Actions enabled
2. The `GITHUB_TOKEN` is automatically provided by GitHub Actions (no setup needed)

## Creating a Release

### Method 1: Using the Release Script (Recommended)

```bash
# Run the release script
./scripts/create-release.sh

# Or specify a version directly
./scripts/create-release.sh 1.0.0
```

This script will:
- Update the version in `package.json`
- Commit the version change
- Create and push a git tag
- Trigger the GitHub Actions workflow

### Method 2: Manual Process

1. Update the version in `package.json`:
   ```bash
   npm version 1.0.0 --no-git-tag-version
   ```

2. Commit the version bump:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.0"
   ```

3. Create and push the tag:
   ```bash
   git tag v1.0.0
   git push origin main
   git push origin v1.0.0
   ```

## What Gets Built

The release workflow builds:

### Windows
- `hydralauncher-X.X.X-portable.exe` - Portable executable (no installation required)
- `hydralauncher-X.X.X-setup.exe` - Full installer

### Linux
- `hydralauncher-X.X.X.AppImage` - Portable Linux application
- `hydralauncher_X.X.X.deb` - Debian package
- Other Linux formats (.rpm, .tar.gz, etc.)

## Local Backup Features

Your fork includes local backup functionality that allows users to:

- Create save game backups locally (without paid cloud service)
- Restore backups from local storage
- Manage backup files (freeze, delete, rename)
- Access backup management through the game details page

This provides a free alternative to the paid cloud backup service in the original Hydra launcher.

## Monitoring the Build

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Find the "Release" workflow
4. Monitor the build progress for Windows and Linux

## Troubleshooting

### Build Fails
- Check the Actions logs for specific error messages
- Ensure all dependencies are properly listed in `package.json`
- Verify that the local backup code doesn't have TypeScript errors

### Release Not Created
- Make sure the tag follows the format `vX.X.X` (e.g., `v1.0.0`)
- Check that GitHub Actions are enabled in your repository settings
- Verify the `GITHUB_TOKEN` has proper permissions

### Missing Files in Release
- Check the `electron-builder.yml` configuration
- Ensure the build artifacts are being generated in the `dist/` directory
- Review the file patterns in the release workflow

## Distribution

Once the release is created, users can download:

1. **Windows users**: Download the `-portable.exe` file for a portable version that doesn't require installation
2. **Linux users**: Download the `.AppImage` file for a portable version, or the `.deb` package for installation

The portable versions include all the local backup functionality and don't require any server setup or paid subscriptions.
