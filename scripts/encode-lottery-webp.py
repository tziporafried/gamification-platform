#!/usr/bin/env python3
"""Encode the rendered frames to an animated WebP with 8-bit alpha.

The local ffmpeg build has no libwebp encoder, so Pillow does this step.
The 60fps master is decimated on the way out. Frame count and pixel size are
what the browser pays for at runtime: every frame is decoded to w*h*4 bytes,
and this loop plays forever on every page, so keeping both small matters more
than absolute smoothness.
"""

import glob
import os
import sys

from PIL import Image

frame_dir, dest = sys.argv[1], sys.argv[2]
quality = int(sys.argv[3]) if len(sys.argv) > 3 else 72
size = int(sys.argv[4]) if len(sys.argv) > 4 else 0
# libwebp stores alpha losslessly by default, which dominates the file size
# here - it halves at 70. Lossy alpha haloes the glow on dark backgrounds, but
# this only ever renders on the modal surface (#FFFFFF, and the app has no dark
# theme), where decoded frames are indistinguishable from the source.
alpha_q = int(sys.argv[5]) if len(sys.argv) > 5 else 70
step = int(sys.argv[6]) if len(sys.argv) > 6 else 2      # 60fps / step
fps = 60 // step

paths = sorted(glob.glob(frame_dir + "/f*.png"))[::step]
frames = [Image.open(p).convert("RGBA") for p in paths]
if size:
    frames = [f.resize((size, size), Image.LANCZOS) for f in frames]

n = len(frames)
edges = [round(i * 1000 / fps) for i in range(n + 1)]
durations = [edges[i + 1] - edges[i] for i in range(n)]

frames[0].save(
    dest,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    lossless=False,
    quality=quality,
    method=4,
    minimize_size=True,
    alpha_quality=alpha_q,
)
print("wrote %s  %dx%d  %d frames  %.2fs  %d KB"
      % (dest, frames[0].width, frames[0].height, n, edges[-1] / 1000,
         os.path.getsize(dest) // 1024))
