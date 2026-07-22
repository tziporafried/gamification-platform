#!/usr/bin/env python3
"""
Renders the Gamify Lottery feature-announcement animation.

Deterministic frame renderer (Pillow), supersampled 2x, true straight alpha.
Outputs raw RGBA PNG frames; encoding to webp/apng/gif is done by the sibling
shell step in scripts/build-lottery-announcement.sh.

No text, no UI, transparent background, seamless loop.
"""

import math
import os
import random
import shutil
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

# ---------------------------------------------------------------- config ----

OUT = 600                      # delivered pixel size
SS = 2                         # supersample factor
S = OUT * SS                   # internal render size
FPS = 60
TOTAL = 6.5                    # seconds, loops seamlessly
FRAMES = int(round(TOTAL * FPS))

FRAME_DIR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/lottery-frames"

# The raffle box is the real product artwork, not a drawn box, so this file
# composites the same PNGs the live ceremony uses.
ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         "..", "public", "images", "lottery")

# --------------------------------------------------------------- timeline ---

T_SETTLE   = (0.00, 0.60)      # box breathes in / loop landing zone
T_TICKETS  = (0.55, 2.65)      # tickets fly in
T_LID      = (2.65, 3.05)      # lid closes
T_SHAKE    = (3.05, 4.15)      # box shakes, slips bounce inside
T_RISE     = (4.15, 4.78)      # winner ticket rises out of the slot
T_FLOAT    = (4.72, 5.30)      # floats to center
T_UNFOLD   = (5.00, 5.40)      # unfolds
T_CONFETTI = 5.30
T_TROPHY   = (5.28, 5.60)      # trophy fades up
T_EXIT     = (5.98, 6.42)      # ticket leaves, lid reopens -> matches t=0

# ----------------------------------------------------------------- colors ---

GLASS_HI   = (236, 252, 255)
GLASS_LO   = (150, 205, 255)
# The halo colours the live box already sits in (boxAssets.tsx).
TINT_VIO   = (120, 90, 255)
TINT_BLUE  = (60, 140, 255)
# Matches the live ceremony's gold ticket tone (Ticket.tsx).
PAPER_HI   = (255, 249, 232)
PAPER_LO   = (255, 228, 154)
PAPER_EDGE = (242, 199, 102)
GOLD_HI    = (255, 214, 104)
GOLD_LO    = (206, 116, 14)
CONFETTI   = [(255, 211, 92), (127, 232, 255), (176, 140, 255),
              (255, 159, 199), (143, 240, 196), (255, 255, 255)]

# -------------------------------------------------------------- box layout --

CX = OUT * 0.5
BOX_BODY_W = 340.0            # on-screen width of the glass body, all states
BOX_BOTTOM = 480.0            # the box stands on this line
REVEAL_Y = 135.0              # where the winning ticket parks
BODY_CY = BOX_BOTTOM - BOX_BODY_W * 0.32   # rough centre of the glass body

# Fraction down the open artwork where the mouth sits - the same measurement
# the live ceremony aims its collecting tickets at (raffleTiming.ts).
MOUTH_FRAC = 0.42
# Fraction down the closed artwork where the coin slot sits.
SLOT_FRAC = 0.075

# ------------------------------------------------------------------ easing --


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


def span(t, a, b):
    """Normalized 0..1 progress of t across [a, b]."""
    return clamp((t - a) / (b - a)) if b > a else (1.0 if t >= b else 0.0)


def out_cubic(u):
    return 1 - (1 - u) ** 3


def in_cubic(u):
    return u ** 3


def in_out_cubic(u):
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def out_quint(u):
    return 1 - (1 - u) ** 5


def out_back(u, k=1.7):
    c = k + 1
    return 1 + c * (u - 1) ** 3 + k * (u - 1) ** 2


def out_elastic(u, p=0.34):
    if u <= 0 or u >= 1:
        return clamp(u)
    return 2 ** (-9 * u) * math.sin((u * 10 - 0.75) * (2 * math.pi) / p / 3.2) + 1


def smoothstep(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


# ------------------------------------------------------------- draw helpers --

def px(v):
    return v * SS


def new_layer():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def vgrad(w, h, top, bottom):
    """Vertical linear gradient as an opaque RGB image."""
    w, h = max(1, int(w)), max(1, int(h))
    g = Image.new("RGB", (1, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        u = y / max(1, h - 1)
        d.point((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * u) for i in range(3)))
    return g.resize((w, h), Image.BILINEAR)


def radial_sprite(size=256, power=2.2):
    """Reusable soft radial falloff, used for every glow/bloom."""
    r = size // 2
    a = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(a)
    steps = 64
    for i in range(steps, 0, -1):
        u = i / steps
        rad = r * u
        val = int(255 * (1 - u) ** power)
        d.ellipse((r - rad, r - rad, r + rad, r + rad), fill=val)
    return a.filter(ImageFilter.GaussianBlur(size / 26))


GLOW = radial_sprite(256)


def glow(layer, x, y, radius, color, alpha):
    """Paste a soft radial glow centred on (x, y) in output units."""
    if alpha <= 0.004 or radius <= 0:
        return
    d = max(2, int(px(radius) * 2))
    m = GLOW.resize((d, d), Image.BILINEAR)
    if alpha < 1.0:
        m = m.point(lambda v, a=alpha: int(v * a))
    tile = Image.new("RGBA", (d, d), color + (0,))
    tile.putalpha(m)
    layer.alpha_composite(tile, (int(px(x) - d / 2), int(px(y) - d / 2)), )


def poly(layer, pts, fill=None, outline=None, width=1.0, grad=None, alpha=1.0):
    """Filled polygon, optionally with a vertical gradient fill."""
    p = [(px(x), px(y)) for x, y in pts]
    if grad is not None:
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).polygon(p, fill=int(255 * alpha))
        ys = [q[1] for q in p]
        xs = [q[0] for q in p]
        x0, x1, y0, y1 = int(min(xs)), int(max(xs)), int(min(ys)), int(max(ys))
        g = vgrad(x1 - x0 + 1, y1 - y0 + 1, grad[0], grad[1]).convert("RGBA")
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        canvas.paste(g, (x0, y0))
        canvas.putalpha(mask)
        layer.alpha_composite(canvas)
    elif fill is not None:
        tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(tmp).polygon(p, fill=fill[:3] + (int(255 * alpha * (fill[3] / 255 if len(fill) > 3 else 1)),))
        layer.alpha_composite(tmp)
    if outline is not None:
        tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(tmp).line(p + [p[0]], fill=outline, width=max(1, int(px(width))), joint="curve")
        layer.alpha_composite(tmp)


def rrect_sprite(w, h, r, grad, edge=None, edge_w=1.6, alpha=1.0):
    """Rounded-rect sprite in supersampled px, gradient filled."""
    w, h = max(2, int(px(w))), max(2, int(px(h)))
    r = min(px(r), min(w, h) / 2)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=int(255 * alpha))
    img = vgrad(w, h, grad[0], grad[1]).convert("RGBA")
    img.putalpha(mask)
    if edge:
        ImageDraw.Draw(img).rounded_rectangle(
            (0, 0, w - 1, h - 1), radius=r, outline=edge + (int(210 * alpha),),
            width=max(1, int(px(edge_w))))
    return img


def paste_rot(layer, sprite, x, y, angle, scale=1.0, alpha=1.0):
    """Rotate + scale a sprite about its centre and composite at (x, y)."""
    if alpha <= 0.004 or scale <= 0.01:
        return
    if scale != 1.0:
        w = max(2, int(sprite.width * scale))
        h = max(2, int(sprite.height * scale))
        sprite = sprite.resize((w, h), Image.LANCZOS)
    if angle:
        sprite = sprite.rotate(angle, resample=Image.BICUBIC, expand=True)
    if alpha < 1.0:
        a = sprite.getchannel("A").point(lambda v: int(v * alpha))
        sprite = sprite.copy()
        sprite.putalpha(a)
    layer.alpha_composite(sprite, (int(px(x) - sprite.width / 2), int(px(y) - sprite.height / 2)))


# --------------------------------------------------------------- geometry ---

def _load_box(name):
    """Trim an asset to its artwork and measure the glass body inside it.

    The open assets are ~925x922 while the closed one is ~877x655, so scaling
    by the full bounds would make the box jump between states. Aligning on the
    body instead keeps the glass a fixed size and lets only the lid move.
    """
    im = Image.open(os.path.join(ASSET_DIR, name)).convert("RGBA")
    mask = im.getchannel("A").point(lambda v: 255 if v > 16 else 0)
    bb = mask.getbbox()
    im = im.crop(bb)
    w, h = im.size
    mp = mask.crop(bb).load()
    left, right = w, 0
    for y in range(int(h * 0.55), h, 3):
        row = [x for x in range(0, w, 2) if mp[x, y]]
        if row:
            left = min(left, row[0])
            right = max(right, row[-1])
    scale = BOX_BODY_W / float(right - left)
    dw, dh = w * scale, h * scale
    sprite = im.resize((max(2, int(dw * SS)), max(2, int(dh * SS))), Image.LANCZOS)
    return {
        "sprite": sprite,
        "cx": CX - ((left + right) / 2.0) * scale + dw / 2.0,   # sprite centre x
        "cy": BOX_BOTTOM - dh / 2.0,                            # sprite centre y
        "top": BOX_BOTTOM - dh,
        "h": dh,
    }


BOXES = {
    "openEmpty": _load_box("raffle-box-open-empty.png"),
    "open": _load_box("raffle-box-open.png"),
    "full": _load_box("raffle-box-full.png"),
}

MOUTH_Y = BOXES["open"]["top"] + BOXES["open"]["h"] * MOUTH_FRAC
SLOT_Y = BOXES["full"]["top"] + BOXES["full"]["h"] * SLOT_FRAC


def box_frame(t):
    """Shake offset + rotation of the whole box at time t."""
    u = span(t, *T_SHAKE)
    if u <= 0 or u >= 1:
        return 0.0, 0.0, 0.0
    # three decaying bursts, each a damped oscillation -> reads as physical
    dx = dy = rot = 0.0
    for start, amp in ((0.00, 1.0), (0.34, 0.86), (0.66, 0.62)):
        k = (u - start) / 0.30
        if 0 <= k <= 1:
            decay = math.exp(-3.4 * k)
            dx += amp * 9.0 * decay * math.sin(k * math.pi * 6.2)
            dy += amp * 4.5 * decay * math.sin(k * math.pi * 8.4 + 1.1)
            rot += amp * 2.6 * decay * math.sin(k * math.pi * 5.6 + 0.4)
    return dx, dy, rot


def box_state(t):
    """Cross-fade weights for the three box assets.

    A bitmap lid cannot hinge, so the close and the re-open are cross-fades.
    The weights always sum to 1 - staggering them leaves a frame where both
    states are faint and the box visibly thins out. The close instead runs
    fast (0.18s) so the overlap reads as a slam rather than a dissolve.
    """
    fill = smoothstep(span(t, 0.9, 2.5))                       # slips pile up
    close = smoothstep(span(t, T_LID[0], T_LID[0] + 0.18))
    reopen = smoothstep(span(t, T_EXIT[0], T_EXIT[0] + 0.30))
    return {
        "openEmpty": (1 - fill) * (1 - close) + reopen,
        "open": fill * (1 - close),
        "full": close * (1 - reopen),
    }


def lid_drop(t):
    """Downward nudge on the open artwork as it fades - sells the lid falling.

    Must unwind during the re-open, or the box lands 18px low at the loop
    point and the seam jumps.
    """
    close = smoothstep(span(t, T_LID[0], T_LID[0] + 0.18))
    reopen = smoothstep(span(t, T_EXIT[0], T_EXIT[0] + 0.30))
    return 18.0 * close * (1 - reopen)


def box_squash(t):
    """Vertical squash: lid impact, then the swell through the shake.

    Both terms must be *exactly* zero outside their windows. sin(pi * 1.0)
    leaves 1.2e-16, which is enough to push the box's paste position across a
    rounding boundary and shift it a pixel at the loop seam.
    """
    sq = 1.0
    k = span(t, T_LID[1] - 0.06, T_LID[1] + 0.26)
    if 0 < k < 1:
        sq -= 0.06 * math.sin(math.pi * k) * math.exp(-2.2 * k)
    u = span(t, *T_SHAKE)
    if 0 < u < 1:
        sq *= 1.0 + 0.05 * math.sin(math.pi * u) ** 0.7
    return sq


# ----------------------------------------------------------------- tickets --

rnd = random.Random(20260722)

N_TICKETS = 14
FLIGHT = 0.95
TICKETS = []
for i in range(N_TICKETS):
    ang = (i / N_TICKETS) * 2 * math.pi + rnd.uniform(-0.22, 0.22)
    dist = rnd.uniform(1.05, 1.45)
    TICKETS.append({
        "t0": T_TICKETS[0] + i * (T_TICKETS[1] - T_TICKETS[0] - FLIGHT) / (N_TICKETS - 1),
        "sx": CX + math.cos(ang) * OUT * dist,
        "sy": BODY_CY + math.sin(ang) * OUT * dist * 0.85,
        "bow": rnd.uniform(-120, 120),
        "spin": rnd.uniform(-540, 540),
        "rot0": rnd.uniform(-180, 180),
        "w": rnd.uniform(34, 44),
        "bounce": rnd.uniform(0.0, 1.0),
    })

TICKET_SPRITES = {}


def ticket_sprite(w, fold=0.0, glowing=0.0):
    """fold 0 = folded (narrow), 1 = fully unfolded."""
    key = (round(w, 1), round(fold, 2), round(glowing, 1))
    if key in TICKET_SPRITES:
        return TICKET_SPRITES[key]
    h = w * 0.95
    full_w = w * (1.0 + 0.62 * fold)
    img = rrect_sprite(full_w, h, w * 0.13, (PAPER_HI, PAPER_LO), PAPER_EDGE, 1.1)
    d = ImageDraw.Draw(img)
    # fold crease, drawn only while it is actually visible: ImageDraw writes
    # pixels rather than compositing, so a 0-alpha line would cut a hole
    crease = int(200 * (1 - fold) ** 1.4)
    if crease > 4:
        d.line([(img.width / 2, px(2)), (img.width / 2, img.height - px(2))],
               fill=PAPER_EDGE + (crease,), width=max(1, int(px(1.1))))
        d.line([(img.width / 2 + px(1.2), px(2)), (img.width / 2 + px(1.2), img.height - px(2))],
               fill=(255, 255, 255, int(crease * 0.75)), width=max(1, int(px(0.8))))
    # the folded half sits slightly in shadow, so it reads as paper, not a chip
    if fold < 0.98:
        shade = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(shade).rectangle(
            (img.width / 2, 0, img.width, img.height),
            fill=(206, 150, 60, int(58 * (1 - fold))))
        shade.putalpha(Image.composite(shade.getchannel("A"),
                                       Image.new("L", img.size, 0),
                                       img.getchannel("A")))
        img.alpha_composite(shade)
    # top specular sheen
    sheen = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sheen).ellipse(
        (-img.width * 0.1, -img.height * 0.75, img.width * 1.1, img.height * 0.42),
        fill=(255, 255, 255, 70))
    sheen.putalpha(Image.composite(sheen.getchannel("A"), Image.new("L", img.size, 0),
                                   img.getchannel("A").point(lambda v: 255 if v > 40 else 0)))
    img.alpha_composite(sheen)
    TICKET_SPRITES[key] = img
    return img


def bezier(p0, p1, p2, u):
    v = 1 - u
    return (v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
            v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1])


# ------------------------------------------------------------- ambient dust --

DUST = []
for i in range(30):
    DUST.append({
        "x": CX + rnd.uniform(-1, 1) * OUT * 0.40,
        "span": rnd.uniform(150, 300),
        "y0": BODY_CY + rnd.uniform(-30, 150),
        "r": rnd.uniform(1.1, 3.0),
        "phase": rnd.random(),
        "loops": rnd.choice([1, 1, 2]),      # integer -> seamless
        "sway": rnd.uniform(8, 26),
        "col": rnd.choice([TINT_BLUE, TINT_VIO, (255, 240, 200), (255, 255, 255)]),
    })

# ---------------------------------------------------------------- confetti --

CONF = []
for i in range(78):
    ang = rnd.uniform(0, 2 * math.pi)
    spd = rnd.uniform(220, 620)
    CONF.append({
        "vx": math.cos(ang) * spd,
        "vy": math.sin(ang) * spd * 0.85 - 130,
        "w": rnd.uniform(6, 13),
        "h": rnd.uniform(3.5, 7),
        "col": rnd.choice(CONFETTI),
        "spin": rnd.uniform(-900, 900),
        "rot0": rnd.uniform(0, 360),
        "flip": rnd.uniform(4, 9),
        "delay": rnd.uniform(0, 0.06),
    })

CONF_SPRITES = {}


def conf_sprite(w, h, col):
    key = (round(w, 1), round(h, 1), col)
    if key not in CONF_SPRITES:
        CONF_SPRITES[key] = rrect_sprite(w, h, min(w, h) * 0.35, (col, col), None)
    return CONF_SPRITES[key]


# ------------------------------------------------------------------ trophy --

def trophy_sprite(size):
    """Chunky, readable trophy. Handles are full rings; the cup is drawn over
    them so only the outer arcs show."""
    w = int(px(size))
    u = w / 100.0
    mask = Image.new("L", (w, w), 0)
    md = ImageDraw.Draw(mask)

    # handles first -- the cup covers their inner halves
    md.ellipse((12 * u, 17 * u, 40 * u, 47 * u), outline=255, width=int(6.5 * u))
    md.ellipse((60 * u, 17 * u, 88 * u, 47 * u), outline=255, width=int(6.5 * u))

    cup = [(29 * u, 15 * u), (71 * u, 15 * u), (69 * u, 38 * u),
           (61 * u, 52 * u), (39 * u, 52 * u), (31 * u, 38 * u)]
    md.polygon(cup, fill=255)
    md.rounded_rectangle((27 * u, 13 * u, 73 * u, 21 * u), radius=3 * u, fill=255)  # lip
    md.rectangle((45 * u, 50 * u, 55 * u, 65 * u), fill=255)                        # stem
    md.rounded_rectangle((34 * u, 63 * u, 66 * u, 72 * u), radius=3 * u, fill=255)  # foot
    md.rounded_rectangle((26 * u, 71 * u, 74 * u, 85 * u), radius=5 * u, fill=255)  # plinth

    img = vgrad(w, w, GOLD_HI, GOLD_LO).convert("RGBA")
    img.putalpha(mask)

    # specular down the left of the cup + a warm rim on the right
    hl = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    hd.polygon([(36 * u, 22 * u), (43 * u, 22 * u), (41 * u, 45 * u), (36 * u, 38 * u)],
               fill=(255, 255, 255, 180))
    hd.polygon([(63 * u, 22 * u), (66 * u, 22 * u), (62 * u, 44 * u), (60 * u, 40 * u)],
               fill=(255, 240, 190, 120))
    hl.putalpha(Image.composite(hl.getchannel("A"), Image.new("L", (w, w), 0), mask))
    img.alpha_composite(hl)

    ImageDraw.Draw(img).rounded_rectangle(
        (27 * u, 13 * u, 73 * u, 21 * u), radius=3 * u,
        outline=(255, 250, 222, 235), width=max(1, int(2 * u)))
    return img


TROPHY = None


def star_sprite(size, color):
    """4-point lens sparkle."""
    w = int(px(size))
    img = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = w / 2
    d.polygon([(c, 0), (c + w * 0.075, c - w * 0.075), (w, c),
               (c + w * 0.075, c + w * 0.075), (c, w),
               (c - w * 0.075, c + w * 0.075), (0, c),
               (c - w * 0.075, c - w * 0.075)], fill=color + (235,))
    img = img.filter(ImageFilter.GaussianBlur(w / 34))
    core = Image.new("RGBA", (w, w), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse((c - w * 0.10, c - w * 0.10, c + w * 0.10, c + w * 0.10),
                                 fill=(255, 255, 255, 240))
    img.alpha_composite(core.filter(ImageFilter.GaussianBlur(w / 40)))
    return img


STAR = None
SPARKS = [(rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0.45, 0.8),
           rnd.uniform(0, 0.34)) for _ in range(6)]


def draw_sparkles(layer, t, x, y, scale, alpha):
    global STAR
    if alpha <= 0.02:
        return
    if STAR is None:
        STAR = star_sprite(44, (255, 236, 176))
    for i, (sx, sy, sz, delay) in enumerate(SPARKS):
        u = span(t, T_CONFETTI + delay, T_CONFETTI + delay + 0.75)
        if u <= 0 or u >= 1:
            continue
        a = math.sin(math.pi * u) ** 1.5 * alpha
        px_ = x + sx * 96 * scale * (0.7 + 0.3 * u)
        py_ = y + sy * 52 * scale * (0.7 + 0.3 * u)
        paste_rot(layer, STAR, px_, py_, i * 24, sz * (0.4 + 0.6 * math.sin(math.pi * u)), a)


# ------------------------------------------------------------------- scene --

def draw_box(layer, t):
    """Composite the real raffle-box artwork for this frame."""
    dx, dy, rot = box_frame(t)
    sq = box_squash(t)
    weights = box_state(t)

    # halo the live ceremony already puts behind the box (boxAssets.tsx)
    charge = math.sin(math.pi * clamp(span(t, *T_SHAKE)))
    if t >= T_SHAKE[1]:
        charge = max(charge, 1 - span(t, T_RISE[0], T_RISE[0] + 0.35))
    body_cy = BOX_BOTTOM - BOX_BODY_W * 0.32
    glow(layer, CX + dx, body_cy + dy, 210, TINT_VIO, 0.20 + 0.16 * charge)
    glow(layer, CX + dx, body_cy + dy + 30, 165, TINT_BLUE, 0.15)
    if charge > 0.01:
        glow(layer, CX + dx, body_cy + dy, 120, (255, 236, 182), 0.34 * charge)

    for name in ("openEmpty", "open", "full"):
        a = weights[name]
        if a <= 0.004:
            continue
        box = BOXES[name]
        sprite = box["sprite"]
        if sq != 1.0:
            sprite = sprite.resize(
                (sprite.width, max(2, int(sprite.height * sq))), Image.LANCZOS)
        # squash keeps the box standing on BOX_BOTTOM rather than shrinking
        # toward its own centre
        cy = BOX_BOTTOM - (box["h"] * sq) / 2.0
        drop = lid_drop(t) if name != "full" else 0.0
        paste_rot(layer, sprite, box["cx"] + dx, cy + dy + drop, rot, 1.0, a)

    # contact shadow
    glow(layer, CX + dx, BOX_BOTTOM + 6, 150, (70, 50, 130), 0.16)


def draw_incoming(layer, t):
    dx, dy, _ = box_frame(t)
    mouth = (CX + dx, MOUTH_Y + dy)
    for tk in TICKETS:
        u = span(t, tk["t0"], tk["t0"] + FLIGHT)
        if u <= 0 or u >= 1:
            continue
        e = in_out_cubic(u)
        # bowed approach + a small settle bounce right at the mouth
        ctrl = ((tk["sx"] + mouth[0]) / 2 + tk["bow"],
                (tk["sy"] + mouth[1]) / 2 - abs(tk["bow"]) * 0.5 - 60)
        x, y = bezier((tk["sx"], tk["sy"]), ctrl, (mouth[0], mouth[1] + 6), e)
        if u > 0.8:
            k = (u - 0.8) / 0.2
            y -= math.sin(k * math.pi) * 7 * tk["bounce"]
        rot = tk["rot0"] + tk["spin"] * out_cubic(u)
        scale = 1.0 - 0.45 * clamp((u - 0.72) / 0.28)      # drops into the box
        # fade in over the first stretch: tickets start outside the frame, and
        # a hard-clipped ticket (plus half its glow disc) at the edge reads as
        # a blob rather than motion
        alpha = smoothstep(clamp(u / 0.14)) * (1.0 - smoothstep(clamp((u - 0.80) / 0.20)))
        sp = ticket_sprite(tk["w"])
        glow(layer, x, y, tk["w"] * 0.8, (255, 240, 200), 0.09 * alpha)
        paste_rot(layer, sp, x, y, rot, scale, alpha)


def winner_state(t):
    """(x, y, rot, scale, fold, alpha) for the winning ticket."""
    mouth_y = SLOT_Y
    rise = span(t, *T_RISE)
    if rise <= 0:
        return None
    e = out_cubic(rise)
    x = CX
    y = mouth_y - 34 * e
    scale = 0.35 + 0.65 * out_back(clamp(rise / 0.8), 1.1)
    alpha = smoothstep(clamp(rise / 0.22))
    rot = 12 * (1 - e)

    fl = span(t, *T_FLOAT)
    if fl > 0:
        ef = in_out_cubic(fl)
        y = (mouth_y - 34) + (REVEAL_Y - (mouth_y - 34)) * ef
        rot = rot * (1 - ef)
        scale = scale + (2.45 - scale) * ef
    # idle float once parked
    if fl >= 1:
        y += math.sin((t - T_FLOAT[1]) * 2.1) * 3.2
        rot += math.sin((t - T_FLOAT[1]) * 1.7) * 1.1

    fold = smoothstep(span(t, *T_UNFOLD))
    ex = span(t, *T_EXIT)
    if ex > 0:
        alpha *= (1 - ex) ** 2
        scale *= 1 + 0.16 * ex
        y -= 62 * in_cubic(ex)
    return x, y, rot, scale, fold, alpha


def draw_winner(layer, t):
    st = winner_state(t)
    if not st:
        return
    x, y, rot, scale, fold, alpha = st
    if alpha <= 0.01:
        return
    base = 46
    glow(layer, x, y, base * scale * (0.85 + fold * 0.45), (255, 236, 180), 0.20 * alpha)
    sp = ticket_sprite(base, fold)
    paste_rot(layer, sp, x, y, rot, scale, alpha)

    draw_sparkles(layer, t, x, y, scale, alpha)

    ta = smoothstep(span(t, *T_TROPHY)) * alpha
    if ta > 0.01:
        global TROPHY
        if TROPHY is None:
            TROPHY = trophy_sprite(46)
        pop = out_back(clamp(span(t, *T_TROPHY)), 2.1)
        glow(layer, x, y, 46 * scale * 0.75, (255, 216, 128), 0.26 * ta)
        paste_rot(layer, TROPHY, x, y - 1, rot * 0.5, scale * 0.95 * (0.55 + 0.45 * pop), ta)


def draw_dust(layer, t):
    for p in DUST:
        u = ((t / TOTAL) * p["loops"] + p["phase"]) % 1.0
        y = p["y0"] - u * p["span"]
        x = p["x"] + math.sin(2 * math.pi * (u * p["loops"] + p["phase"])) * p["sway"]
        a = math.sin(math.pi * u) ** 1.4
        glow(layer, x, y, p["r"] * 3.4, p["col"], 0.42 * a)


def draw_confetti(layer, t):
    if t < T_CONFETTI:
        return
    cx, cy = CX, REVEAL_Y
    k = 2.4      # drag
    g = 980.0
    for c in CONF:
        dt = t - T_CONFETTI - c["delay"]
        if dt <= 0:
            continue
        life = clamp(dt / (TOTAL - T_CONFETTI - 0.08))
        ex = math.exp(-k * dt)
        x = cx + c["vx"] / k * (1 - ex)
        y = cy + (c["vy"] + g / k) / k * (1 - ex) - g * dt / k
        alpha = smoothstep(clamp(dt / 0.06)) * (1 - smoothstep(clamp((life - 0.55) / 0.45)))
        if alpha <= 0.01:
            continue
        # paper flutter: horizontal squash as it spins edge-on
        sq = abs(math.cos(dt * c["flip"]))
        sp = conf_sprite(max(2.0, c["w"] * (0.25 + 0.75 * sq)), c["h"], c["col"])
        paste_rot(layer, sp, x, y, c["rot0"] + c["spin"] * dt * 0.35, 1.0, alpha)
    # burst flash
    fl = 1 - clamp((t - T_CONFETTI) / 0.34)
    if fl > 0:
        glow(layer, cx, cy, 120 + 90 * (1 - fl), (255, 255, 255), 0.38 * fl ** 2)


def render(t):
    layer = new_layer()

    draw_dust(layer, t)
    draw_box(layer, t)
    draw_incoming(layer, t)
    draw_confetti(layer, t)
    draw_winner(layer, t)

    # highlight bloom: only bright pixels blow out, so empty canvas stays
    # genuinely empty -- looks more like real optics and compresses far better
    small = layer.resize((S // 4, S // 4), Image.BILINEAR)
    key = ImageChops.multiply(small.convert("L"), small.getchannel("A"))
    key = key.point(lambda v: 0 if v < 118 else min(255, int((v - 118) * 1.9)))
    bl = small.copy()
    bl.putalpha(key)
    bl = bl.filter(ImageFilter.GaussianBlur(S / 4 / 17))
    bloom = bl.resize((S, S), Image.BILINEAR)
    bloom.putalpha(bloom.getchannel("A").point(lambda v: int(v * 0.40)))

    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.alpha_composite(bloom)
    out.alpha_composite(layer)

    # clamp near-zero alpha to zero: invisible anyway, and it keeps the empty
    # regions a flat constant for the encoders
    out.putalpha(out.getchannel("A").point(lambda v: 0 if v < 8 else v))

    return out.resize((OUT, OUT), Image.LANCZOS)


def main():
    if os.path.isdir(FRAME_DIR):
        shutil.rmtree(FRAME_DIR)
    os.makedirs(FRAME_DIR)
    for i in range(FRAMES):
        t = i / FPS
        render(t).save(os.path.join(FRAME_DIR, "f%04d.png" % i))
        if i % 30 == 0:
            print("  frame %3d/%d" % (i, FRAMES), flush=True)
    print("rendered %d frames -> %s" % (FRAMES, FRAME_DIR))


if __name__ == "__main__":
    main()
