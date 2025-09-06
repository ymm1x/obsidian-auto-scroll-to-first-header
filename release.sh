#!/bin/bash
set -eu

VERSION=$1
NOTES="${2:-}"

if [ -z "$VERSION" ]; then
	echo "Usage: ./release.sh <version> [<release notes>]"
	exit 1
fi

build() {
	npm run build
}

version_bump() {
	node version-bump.mjs
	git add manifest.json versions.json package.json
	git commit -m "Release v$VERSION"
	git push
}

tagging() {
	git tag "v$VERSION"
	git push --tags
}

github_release() {
	gh release create "v$VERSION" main.js manifest.json styles.css --title "v$VERSION" --notes "$NOTES"
}

main() {
	build
	version_bump
	tagging
	github_release
}

main
