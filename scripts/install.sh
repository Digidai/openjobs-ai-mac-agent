#!/bin/bash
# OpenJobs AI — One-line installer for macOS
# Usage: curl -fsSL https://digidai.github.io/openjobs-ai-releases/install.sh | bash
#
# Downloads the latest release from GitHub, installs to /Applications, and removes quarantine.
# No Apple Developer certificate needed — curl downloads don't trigger Gatekeeper.

set -euo pipefail

APP_NAME="OpenJobs AI"
REPO="Digidai/openjobs-ai-releases"
INSTALL_DIR="/Applications"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${BLUE}==>${NC} $*"; }
ok()    { echo -e "${GREEN}==>${NC} $*"; }
warn()  { echo -e "${YELLOW}==>${NC} $*"; }
error() { echo -e "${RED}Error:${NC} $*" >&2; exit 1; }

# Check platform
[[ "$(uname -s)" == "Darwin" ]] || error "This installer only supports macOS."

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  arm64)  ASSET_SUFFIX="arm64.dmg" ;;
  x86_64) ASSET_SUFFIX="x64.dmg" ;;
  *)      error "Unsupported architecture: $ARCH" ;;
esac

info "Detecting latest version..."

# Fetch latest release info from GitHub API
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")" \
  || error "Failed to fetch release info. Check your network connection."

# Parse version and download URL
VERSION="$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
DOWNLOAD_URL="$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep "$ASSET_SUFFIX" | grep -v '.blockmap' | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')"

[[ -n "$VERSION" ]]      || error "Could not determine latest version."
[[ -n "$DOWNLOAD_URL" ]] || error "Could not find a download for ${ASSET_SUFFIX}."

info "Latest version: ${VERSION}"
info "Architecture: ${ARCH}"

# Check if already installed with same version
if [[ -d "${INSTALL_DIR}/${APP_NAME}.app" ]]; then
  INSTALLED_VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${INSTALL_DIR}/${APP_NAME}.app/Contents/Info.plist" 2>/dev/null || echo "")"
  CLEAN_VERSION="${VERSION#v}"
  if [[ "$INSTALLED_VERSION" == "$CLEAN_VERSION" ]]; then
    ok "${APP_NAME} ${VERSION} is already installed."
    exit 0
  fi
  warn "Upgrading from v${INSTALLED_VERSION} to ${VERSION}..."
fi

# Create temp directory
TMPDIR_INSTALL="$(mktemp -d)"
DMG_PATH="${TMPDIR_INSTALL}/${APP_NAME}.dmg"
trap 'rm -rf "$TMPDIR_INSTALL"; hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true' EXIT

# Download (curl doesn't add quarantine — this is the key!)
info "Downloading ${APP_NAME} ${VERSION}..."
curl -fSL --progress-bar -o "$DMG_PATH" "$DOWNLOAD_URL" \
  || error "Download failed."

ok "Download complete ($(du -h "$DMG_PATH" | awk '{print $1}'))"

# Mount DMG
info "Mounting disk image..."
MOUNT_OUTPUT="$(hdiutil attach "$DMG_PATH" -nobrowse -noautoopen 2>&1)" \
  || error "Failed to mount DMG."
MOUNT_POINT="$(echo "$MOUNT_OUTPUT" | grep '/Volumes/' | tail -1 | sed 's/.*\(\/Volumes\/.*\)/\1/' | xargs)"

[[ -d "$MOUNT_POINT" ]] || error "Could not determine mount point."

# Find .app bundle
APP_BUNDLE="$(find "$MOUNT_POINT" -maxdepth 1 -name '*.app' | head -1)"
[[ -n "$APP_BUNDLE" ]] || error "No .app bundle found in DMG."

# Install to /Applications
info "Installing to ${INSTALL_DIR}..."
if [[ -d "${INSTALL_DIR}/${APP_NAME}.app" ]]; then
  rm -rf "${INSTALL_DIR}/${APP_NAME}.app" 2>/dev/null \
    || sudo rm -rf "${INSTALL_DIR}/${APP_NAME}.app"
fi

cp -R "$APP_BUNDLE" "${INSTALL_DIR}/" 2>/dev/null \
  || sudo cp -R "$APP_BUNDLE" "${INSTALL_DIR}/"

# Remove quarantine (belt and suspenders — curl shouldn't add it, but just in case)
xattr -cr "${INSTALL_DIR}/${APP_NAME}.app" 2>/dev/null || true

# Detach DMG
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
MOUNT_POINT=""

ok "${APP_NAME} ${VERSION} installed successfully!"
echo ""
echo -e "  Open it with:  ${GREEN}open -a '${APP_NAME}'${NC}"
echo ""

# Offer to open
read -r -p "Open ${APP_NAME} now? [Y/n] " response
case "$response" in
  [nN]*) ;;
  *)     open -a "$APP_NAME" ;;
esac
