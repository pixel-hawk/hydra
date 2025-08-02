#!/bin/bash

# Script to create a new release
# Usage: ./scripts/create-release.sh [version]

set -e

# Get version from argument or prompt user
if [ -z "$1" ]; then
    echo "Current version in package.json:"
    grep '"version"' package.json
    echo ""
    read -p "Enter new version (e.g., 1.0.0): " VERSION
else
    VERSION=$1
fi

# Validate version format
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in format x.y.z (e.g., 1.0.0)"
    exit 1
fi

echo "Creating release for version $VERSION..."

# Update package.json version
npm version $VERSION --no-git-tag-version

# Commit the version bump
git add package.json
git commit -m "Bump version to $VERSION"

# Create and push tag
git tag "v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo "✅ Release v$VERSION created successfully!"
echo ""
echo "The GitHub Actions workflow will now:"
echo "1. Build Windows and Linux versions"
echo "2. Create a GitHub release with the built files"
echo "3. Upload the portable executable and other distribution files"
echo ""
echo "Check the Actions tab in your GitHub repository to monitor the build progress."
echo "Once complete, you'll find the release at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases"
