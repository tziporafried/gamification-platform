#!/usr/bin/env bash
# Builds the Gamify Lottery feature-announcement loop.
#
#   ./scripts/build-lottery-announcement.sh
#
# Renders 390 straight-alpha PNG frames (600px, 60fps, 6.5s, seamless) and
# encodes delivery copies at 480px / 30fps, sized for a ~300px popup slot:
#
#   lottery.webp - animated WebP, 8-bit alpha   <- use this
#   lottery.gif  - GIF, 1-bit alpha             <- fallback only; the soft
#                                                  glow and bloom do not
#                                                  survive 1-bit transparency
#
# No APNG: it comes out ~13MB here, and every browser that would need it
# already supports animated WebP.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRAMES="${TMPDIR:-/tmp}/lottery-frames"
DEST="$ROOT/public/images/lottery-announcement"
mkdir -p "$DEST"

echo "==> rendering frames"
python3 "$ROOT/scripts/lottery-announcement-anim.py" "$FRAMES"

echo "==> animated webp (8-bit alpha, 480px, 30fps)"
# This ffmpeg build has no libwebp encoder, so Pillow does this one.
python3 "$ROOT/scripts/encode-lottery-webp.py" "$FRAMES" "$DEST/lottery.webp" 74 480 70

echo "==> gif fallback (1-bit alpha, 480px, 30fps)"
ffmpeg -v error -y -framerate 60 -i "$FRAMES/f%04d.png" -filter_complex \
  "fps=30,scale=480:480:flags=lanczos,split[a][b];\
[a]palettegen=reserve_transparent=1:stats_mode=diff[p];\
[b][p]paletteuse=alpha_threshold=110:dither=sierra2_4a:diff_mode=rectangle" \
  -loop 0 "$DEST/lottery.gif"

ls -lh "$DEST"
