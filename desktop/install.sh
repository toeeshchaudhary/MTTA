#!/usr/bin/env bash
# Install MTTA Studio as a launchable app (rofi / i3), following the same pattern as
# the user's other ~/.local apps. Idempotent — re-run after moving the repo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$HOME/.local/bin"
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons"
mkdir -p "$BIN" "$APPS" "$ICONS"

# 1. launcher (bake in the repo path)
sed "s|__REPO__|$REPO|g" "$REPO/desktop/build/mtta-studio" > "$BIN/mtta-studio"
chmod +x "$BIN/mtta-studio"

# 2. icon
cp "$REPO/desktop/build/icon.png" "$ICONS/mtta-studio.png"

# 3. desktop entry (bake in the bin + icon paths)
sed -e "s|__BIN__|$BIN|g" -e "s|__ICON__|$ICONS/mtta-studio.png|g" \
    "$REPO/desktop/build/mtta-studio.desktop" > "$APPS/mtta-studio.desktop"

update-desktop-database "$APPS" 2>/dev/null || true

echo "✓ MTTA Studio installed"
echo "  launcher : $BIN/mtta-studio"
echo "  entry    : $APPS/mtta-studio.desktop"
echo "  launch it from rofi (Mod+d) → 'MTTA Studio', or run: mtta-studio"
