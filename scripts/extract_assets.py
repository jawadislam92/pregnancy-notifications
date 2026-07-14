"""
Asset extraction pipeline (run once, offline).

Turns the approved Canva design + data workbook into the self-contained assets
the app renders with. Re-run only when the design or artwork changes.

Inputs (edit paths below if they move):
  - PDF : the 10-page Canva export ("Kopie von Pregnancy Calendar.pdf")
  - XLSX: the data workbook with the 37 embedded fruit illustrations

Outputs (committed to the repo):
  - assets/fruit/week-XX.png   clean fruit illustration per week
  - assets/plates/week-XX.png  raster artwork only (no text) — reference layer
  - assets/deco/flower.png      week-marker flower
  - assets/base/week-XX.png    the render background: full artwork with the text,
                               month/year and calendar erased, ready for overlay

Requires: pymupdf, openpyxl, pillow   (pip install pymupdf openpyxl pillow)
"""
import fitz, openpyxl, io, os, sys, json, statistics
from collections import deque
from PIL import Image, ImageDraw, ImageFilter, ImageChops

FRUITBOX = {}   # week -> [x, y, w, h] fruit-illustration box (design coords), for the overlay

PDF  = r"C:\Users\jawad\Downloads\Documents\canva.pdf"
XLSX = r"C:\Users\jawad\Downloads\Pregnancy Calendar Overview.xlsx"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# --print: rebuild the page backgrounds at true print resolution (300 dpi over
# the design's 20x11.25in trim = 6000x3375) for the PDF pipeline. The default
# 2x set stays as the fast web-preview background. Print bases are JPEG (q92,
# no chroma subsampling): visually lossless on this artwork, ~5x smaller.
PRINT = "--print" in sys.argv
SCALE = (300 / 72) if PRINT else 2.0
PLATES_DIR = "print-plates" if PRINT else "plates"
BASE_DIR = "print" if PRINT else "base"
MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]

def apath(*p):
    fp = os.path.join(ROOT, "assets", *p); os.makedirs(os.path.dirname(fp), exist_ok=True); return fp
def s(v): return int(round(v * SCALE))

def _largest_blob(binary):
    """0/255 mask of the largest connected opaque blob in a small 'L' image."""
    w, h = binary.size; px = binary.load(); seen = bytearray(w * h); best = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy] < 128: continue
            comp = []; dq = deque([(sx, sy)]); seen[sy * w + sx] = 1
            while dq:
                x, y = dq.popleft(); comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] >= 128:
                        seen[ny * w + nx] = 1; dq.append((nx, ny))
            if len(comp) > len(best): best = comp
    m = Image.new("L", (w, h), 0); mp = m.load()
    for x, y in best: mp[x, y] = 255
    return m

def key_fruit_bg(im, thresh=42):
    """The XLSX fruit illustrations sit on a pale opaque background. Key it out
    (border-seeded flood fill so pale interior fruit parts survive), keep only
    the largest blob (drops the watercolor splatter specks), crop to content."""
    im = im.convert("RGB"); w, h = im.size; work = im.copy(); SENT = (255, 0, 255)
    for sx, sy in [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1), (w//2, 0), (w//2, h-1), (0, h//2), (w-1, h//2)]:
        try: ImageDraw.floodfill(work, (sx, sy), SENT, thresh=thresh)
        except Exception: pass
    wp = work.load(); a = Image.new("L", (w, h), 255); ap = a.load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] == SENT: ap[x, y] = 0
    small = a.resize((220, 220), Image.BILINEAR).point(lambda v: 255 if v > 110 else 0)
    comp = _largest_blob(small).filter(ImageFilter.MaxFilter(7))   # dilate to keep soft edge/shadow
    a = ImageChops.multiply(a, comp.resize((w, h), Image.BILINEAR)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert("RGBA"); out.putalpha(a); bb = a.getbbox()
    return out.crop(bb) if bb else out

def extract_fruit():
    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    for img in getattr(ws, "_images", []):
        row = img.anchor._from.row            # 0-based; sheet row 2 == week 4
        week = 4 + (row - 1)
        im = Image.open(io.BytesIO(img._data()))
        key_fruit_bg(im).save(apath("fruit", f"week-{week:02d}.png"))
    print("fruit: done")

def load_rgba(doc, xref, cache={}):
    """Extract an image WITH its soft-mask (alpha) applied."""
    if xref in cache: return cache[xref]
    base = fitz.Pixmap(doc, xref)
    sm = doc.extract_image(xref).get("smask", 0)
    if sm:
        try: base = fitz.Pixmap(base, fitz.Pixmap(doc, sm))
        except Exception: pass
    if base.colorspace and base.colorspace.n == 4:
        base = fitz.Pixmap(fitz.csRGB, base)
    im = Image.open(io.BytesIO(base.tobytes("png"))).convert("RGBA")
    cache[xref] = im
    return im

def _detail(img):
    """Luminance stddev over the opaque region. Fruit illustrations are painted
    (dark eyes, outline, texture) → high variance; watercolor washes are smooth
    and pale → ~0. A robust way to tell the fruit from the washes behind it."""
    im = img.convert("RGBA").resize((80, 80)); px = im.load(); lums = []
    for y in range(80):
        for x in range(80):
            r, g, b, a = px[x, y]
            if a < 128: continue
            lums.append(0.299 * r + 0.587 * g + 0.114 * b)
    if len(lums) < 50: return 0.0
    m = sum(lums) / len(lums)
    return (sum((v - m) ** 2 for v in lums) / len(lums)) ** 0.5

def find_fruit(doc, pg):
    """(xref, visible_box) of the fruit illustration in design coords, or (None,
    None). The fruit is the highest-detail raster in the left fruit zone."""
    best = (6.0, None, None)   # require some detail so a page with no fruit → None
    for im in pg.get_image_info(xrefs=True):
        x0, y0, x1, y1 = im['bbox']; w, h = x1 - x0, y1 - y0; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if im['xref'] <= 0 or not (cx < 430 and 300 < cy < 820 and w > 120 and h > 120):
            continue
        sd = _detail(load_rgba(doc, im['xref']))
        if sd > best[0]: best = (sd, im['xref'], (x0, y0, x1, y1))
    xref, pb = best[1], best[2]
    if xref is None: return None, None
    img = load_rgba(doc, xref); vb = img.split()[3].getbbox(); sw, sh = img.size
    if not vb: return xref, pb
    X0, Y0, X1, Y1 = pb
    return xref, (X0 + vb[0] / sw * (X1 - X0), Y0 + vb[1] / sh * (Y1 - Y0),
                  X0 + vb[2] / sw * (X1 - X0), Y0 + vb[3] / sh * (Y1 - Y0))

def build_plates_and_flower(doc):
    saved_flower = False
    for pi, week in enumerate(MILESTONES):
        pg = doc[pi]
        W, H = int(pg.rect.width * SCALE), int(pg.rect.height * SCALE)
        canvas = Image.new("RGBA", (W, H), (251, 247, 242, 255))
        canvas_clean = Image.new("RGBA", (W, H), (251, 247, 242, 255))  # clean fruit-zone twin
        saved_page_flower = False
        # a raster is "fruit-zone clutter" (the fruit or any wash blob behind it) if
        # its centre is in the left fruit area — excluded from the clean twin so the
        # zone becomes plain cream (the fruit + a uniform wash are overlaid at render)
        def fruit_zone_clutter(cx, cy, w, h):
            return cx < 400 and 335 < cy < 700
        for im in sorted(pg.get_image_info(xrefs=True),
                         key=lambda d: -((d['bbox'][2]-d['bbox'][0])*(d['bbox'][3]-d['bbox'][1]))):
            x0, y0, x1, y1 = im['bbox']; w, h = x1-x0, y1-y0
            cx, cy = (x0+x1)/2, (y0+y1)/2
            if im['xref'] <= 0: continue
            src = load_rgba(doc, im['xref'])
            is_flower = (w < 45 and h < 45 and 405 < cx < 1270 and 330 < cy < 640)
            if is_flower:
                # each page decorates its highlight with its own flower
                if not saved_page_flower:
                    src.save(apath("deco", f"flower-{week:02d}.png")); saved_page_flower = True
                if not saved_flower:
                    src.save(apath("deco", "flower.png")); saved_flower = True
                continue
            sized = src.resize((max(1, s(w)), max(1, s(h))), Image.LANCZOS)
            canvas.alpha_composite(sized, (s(x0), s(y0)))
            if not fruit_zone_clutter(cx, cy, w, h):   # clean twin drops fruit + wash blobs
                canvas_clean.alpha_composite(sized, (s(x0), s(y0)))
        ext = "jpg" if PRINT else "png"
        kw = dict(quality=95, subsampling=0) if PRINT else dict(quality=95)
        canvas.convert("RGB").save(apath(PLATES_DIR, f"week-{week:02d}.{ext}"), **kw)
        canvas_clean.convert("RGB").save(apath(PLATES_DIR, f"tmpl-{week:02d}.{ext}"), **kw)
    print("plates (+ fruit-less templates) + flower: done")

def erase_interp(base, x0, y0, x1, y1, mask=None, ring=(4, 18), force_horiz=False):
    """Erase a rect by blending between the median colours of strips just
    OUTSIDE its edges, along the SHORT axis. `mask` (set of other erase rects)
    keeps the sampling away from still-unerased text ink. When the two strips
    differ strongly the rect sits at a shape's edge (callout bar, clipboard) —
    then the lower/right strip wins, since text hugs the TOP of those shapes."""
    W, H = base.size
    x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W - 1, int(x1)), min(H - 1, int(y1))
    if x1 <= x0 or y1 <= y0: return
    px = base.load()
    def masked(x, y):
        if not mask: return False
        for mx0, my0, mx1, my1 in mask:
            if mx0 <= x <= mx1 and my0 <= y <= my1: return True
        return False
    FALLBACK = (250, 246, 241)
    def walk(fixed, lo, step, horiz):
        """Walk outward from a rect edge, past masked (unerased-text) bands,
        until a clean 3px band is found; return its median colour."""
        pos = lo
        for _ in range(90):
            pos += step
            pts = []
            for f in (fixed - 2, fixed, fixed + 2):
                for o in (pos, pos + step, pos + 2 * step):
                    x, y = (o, f) if horiz else (f, o)
                    if 0 <= x < W and 0 <= y < H and not masked(x, y):
                        pts.append(px[x, y])
            if len(pts) >= 4:
                return tuple(int(statistics.median(c[i] for c in pts)) for i in range(3))
        return None
    if (x1 - x0) >= (y1 - y0) and not force_horiz:
        h = y1 - y0
        for x in range(x0, x1 + 1):
            T = walk(x, y0 - ring[0], -1, horiz=False)
            B = walk(x, y1 + ring[0], +1, horiz=False)
            if T is None and B is None: T = B = FALLBACK
            elif T is None: T = B
            elif B is None: B = T
            for y in range(y0, y1 + 1):
                t = (y - y0) / h if h else 0
                px[x, y] = tuple(int(T[i] + (B[i] - T[i]) * t) for i in range(3))
    else:
        w = x1 - x0
        for y in range(y0, y1 + 1):
            L = walk(y, x0 - ring[0], -1, horiz=True)
            R = walk(y, x1 + ring[0], +1, horiz=True)
            if L is None and R is None: L = R = FALLBACK
            elif L is None: L = R
            elif R is None: R = L
            for x in range(x0, x1 + 1):
                t = (x - x0) / w if w else 0
                px[x, y] = tuple(int(L[i] + (R[i] - L[i]) * t) for i in range(3))

def erase_replicate_right(base, x0, y0, x1, y1, mask=None):
    """Erase a rect by filling each row with the colour found just RIGHT of it.
    Perfect for text on horizontally-uniform shapes (badge blob, callout bar,
    notes clipboard): rows above/below the shape pick up the page background,
    rows inside pick up the shape — boundaries handled automatically."""
    W, H = base.size
    x0, y0, x1, y1 = max(0, int(x0)), max(0, int(y0)), min(W - 1, int(x1)), min(H - 1, int(y1))
    if x1 <= x0 or y1 <= y0: return
    px = base.load()
    def masked(x, y):
        if not mask: return False
        for mx0, my0, mx1, my1 in mask:
            if mx0 <= x <= mx1 and my0 <= y <= my1: return True
        return False
    for y in range(y0, y1 + 1):
        col = None; pos = x1 + 4
        for _ in range(300):
            pts = [px[xx, yy] for xx in (pos, pos + 1, pos + 2) for yy in (y - 1, y, y + 1)
                   if 0 <= xx < W and 0 <= yy < H and not masked(xx, yy)]
            if len(pts) >= 4:
                col = tuple(int(statistics.median(c[i] for c in pts)) for i in range(3)); break
            pos += 3
        if col is None: col = (250, 246, 241)
        for x in range(x0, x1 + 1):
            px[x, y] = col

def path_clusters(pg, zone, max_side=95, gap=10):
    """Cluster tiny vector-path fragments inside `zone` into bounding boxes."""
    zx0, zy0, zx1, zy1 = zone
    pts = []
    for dr in pg.get_drawings():
        xs, ys = [], []
        for it in dr['items']:
            for pt in it[1:]:
                if hasattr(pt, 'x'): xs.append(pt.x); ys.append(pt.y)
                elif isinstance(pt, fitz.Rect): xs += [pt.x0, pt.x1]; ys += [pt.y0, pt.y1]
        if not xs: continue
        bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
        if zx0 < bx0 and bx1 < zx1 and zy0 < by0 and by1 < zy1 and (bx1 - bx0) < max_side:
            pts.append([bx0, by0, bx1, by1])
    changed = True
    while changed:
        changed = False
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                a, b = pts[i], pts[j]
                if a[0] - gap < b[2] and b[0] - gap < a[2] and a[1] - gap < b[3] and b[1] - gap < a[3]:
                    pts[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del pts[j]; changed = True; break
            if changed: break
    return pts

def save_bullet_heart(pg, pristine, week):
    """The Mama-list bullet hearts are vector art on a flat card background —
    crop the first one from the pristine raster and key out the background."""
    clusters = path_clusters(pg, (1188, 350, 1224, 648), max_side=28)
    if not clusters: return
    bx0, by0, bx1, by1 = sorted(clusters, key=lambda c: c[1])[0]
    # clamp to one heart's footprint — a loose cluster can lasso a neighbour
    hx, hy = (bx0 + bx1) / 2, (by0 + by1) / 2
    crop = pristine.crop((s(hx - 8.5), s(hy - 8.5), s(hx + 8.5), s(hy + 8.5))).convert("RGBA")
    px = crop.load()
    w, h = crop.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(int(statistics.median(c[i] for c in corners)) for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            a = 0 if d < 30 else min(255, (d - 30) * 12)
            px[x, y] = (r, g, b, a)
    crop.save(apath("deco", f"bullet-heart-{week:02d}.png"))

def find_frame(pg):
    """The calendar's outer frame rect (varies slightly per page)."""
    frame = None
    for dr in pg.get_drawings():
        for it in dr['items']:
            if it[0] != 're': continue
            r = it[1]
            w, h = r.x1 - r.x0, r.y1 - r.y0
            if w > 700 and h > 500 and 350 < r.x0 < 400:
                if frame is None or w * h > (frame[2] - frame[0]) * (frame[3] - frame[1]):
                    frame = (r.x0, r.y0, r.x1, r.y1)
    return frame or (373.7, 71.9, 1144.3, 634.4)

def month_decor_boxes(pg):
    """Bounding boxes of the vector decorations near the month title (the pink
    heart + botanical sprig). Clustered from tiny path fragments so restore
    boxes adapt to each page's design."""
    pts = []
    for dr in pg.get_drawings():
        xs, ys = [], []
        for it in dr['items']:
            for pt in it[1:]:
                if hasattr(pt, 'x'): xs.append(pt.x); ys.append(pt.y)
                elif isinstance(pt, fitz.Rect): xs += [pt.x0, pt.x1]; ys += [pt.y0, pt.y1]
        if not xs: continue
        bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
        # only the heart+sprig above the year (by1 < 150) — the old upper bound of
        # 175 also grabbed a stray mauve fragment sitting next to "2026" (the "v").
        if 245 < bx0 and bx1 < 385 and 30 < by0 and by1 < 150 and (bx1 - bx0) < 90:
            pts.append([bx0, by0, bx1, by1])
    # merge overlapping/nearby fragments into clusters
    changed = True
    while changed:
        changed = False
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                a, b = pts[i], pts[j]
                if a[0] - 10 < b[2] and b[0] - 10 < a[2] and a[1] - 10 < b[3] and b[1] - 10 < a[3]:
                    pts[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del pts[j]; changed = True; break
            if changed: break
    return pts

def save_keyed_sprite(pg, pristine, week, zone, name, max_side=95):
    """Crop a vector decoration from the pristine raster and key out the
    background -> RGBA sprite (used for the last-row leaf sprig)."""
    clusters = path_clusters(pg, zone, max_side=max_side)
    if not clusters: return
    bx0, by0, bx1, by1 = max(clusters, key=lambda c: (c[2] - c[0]) * (c[3] - c[1]))
    if (bx1 - bx0) < 8 or (by1 - by0) < 8: return
    crop = pristine.crop((s(bx0 - 1), s(by0 - 1), s(bx1 + 1), s(by1 + 1))).convert("RGBA")
    px = crop.load(); w, h = crop.size
    ring = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for x in (0, w - 1) for y in range(h)]
    bg = tuple(int(statistics.median(c[i] for c in ring)) for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y][:3]
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            px[x, y] = (r, g, b, 0 if d < 12 else min(255, (d - 12) * 14))
    crop.save(apath("deco", f"{name}-{week:02d}.png"))

def paste_feathered(base, plate, box, feather=None):
    if feather is None: feather = max(8, int(7 * SCALE))
    """Paste a plate region with soft edges so the (slightly different) plate
    rendering never shows as a hard-edged rectangle."""
    crop = plate.crop(box)
    w, h = crop.size
    m = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(m)
    for i in range(feather):
        md.rectangle([i, i, w - 1 - i, h - 1 - i], outline=int(255 * (i + 1) / feather))
    md.rectangle([feather, feather, w - 1 - feather, h - 1 - feather], fill=255)
    base.paste(crop, box[:2], m)

def restore_keyed(base, pristine, bx0, by0, bx1, by1, thresh=12, slope=14):
    """Composite only the INK of a pristine region back (background keyed out)."""
    box = (s(bx0 - 2), s(by0 - 2), s(bx1 + 2), s(by1 + 2))
    crop = pristine.crop(box).convert("RGBA")
    cpx = crop.load(); cw, ch = crop.size
    ring = [cpx[x, y] for x in range(cw) for y in (0, ch - 1)] + \
           [cpx[x, y] for x in (0, cw - 1) for y in range(ch)]
    bg = tuple(int(statistics.median(c[i] for c in ring)) for i in range(3))
    for yy in range(ch):
        for xx in range(cw):
            r, g, b2 = cpx[xx, yy][:3]
            dd = abs(r - bg[0]) + abs(g - bg[1]) + abs(b2 - bg[2])
            cpx[xx, yy] = (r, g, b2, 0 if dd < thresh else min(255, (dd - thresh) * slope))
    base.paste(crop, box[:2], crop)

def build_bases(doc):
    WASH_BOX = (0, 0, s(354), s(204))              # month wash block; y204 covers the
    #   template month's own y-descender (e.g. February/January) which used to leave
    #   a stray mauve "v" below the old y180 boundary. Stays above the badge pill (~212).
    FRUIT_BOX = (0, s(292), s(390), s(432))        # sizeOf + fruit-name zone
    for pi, week in enumerate(MILESTONES):
        pg = doc[pi]
        pix = pg.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        base = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        pristine = base.copy()
        save_bullet_heart(pg, pristine, week)
        plate_ext = "jpg" if PRINT else "png"
        plate = Image.open(apath(PLATES_DIR, f"week-{week:02d}.{plate_ext}")).convert("RGB")
        d = ImageDraw.Draw(base)
        # calendar panel -> flat cell colour, hugging this page's real frame so the
        # erase never bleeds onto the callout bar or surrounding artwork; the
        # frame's top band + column ticks above y=106 stay, so the drawn grid
        # connects seamlessly to the baked artwork
        fx0, fy0, fx1, fy1 = find_frame(pg)
        cellfill = base.getpixel((s(fx0 + 60), s(190)))
        CAL_BOX = (s(fx0 - 3), s(106), s(fx1 + 3), s(fy1 + 4))
        d.rectangle(CAL_BOX, fill=cellfill)
        # also erase the BAKED column-tick stubs in the header band (they sit a
        # hair off the drawn grid and doubled up) — but protect the washi tape
        tape = None
        for info in pg.get_image_info():
            ix0, iy0, ix1, iy1 = info['bbox']
            if iy0 < fy0 + 40 and iy1 > fy0 and 80 < (ix1 - ix0) < 320 and 450 < ix0 < 950:
                tape = (ix0 - 5, ix1 + 5); break
        if tape is None: tape = (655, 850)
        d.rectangle((s(fx0 + 2), s(fy0 + 3), s(tape[0]), s(107)), fill=cellfill)
        d.rectangle((s(tape[1]), s(fy0 + 3), s(fx1 - 2), s(107)), fill=cellfill)
        # month + year -> clean wash-block artwork from the image-only plate
        # (identical texture, no interpolation seams); decor restored after.
        # Same for the fruit-name zone: erasing text there smeared adjacent
        # artwork (raspberry stem, carrot leaves) — the plate is already clean.
        paste_feathered(base, plate, WASH_BOX)
        paste_feathered(base, plate, FRUIT_BOX)
        # last-row leaf sprig sprite (rendered dynamically into the trailing
        # empty cell when the customer's month has one)
        save_keyed_sprite(pg, pristine, week, (1028, 545, 1142, 633), "cellsprig", max_side=80)
        # collect all text-erase rects first, so the interpolation can avoid
        # sampling neighbouring text ink that hasn't been erased yet
        rects = []      # (rect, mode)
        for b in pg.get_text("dict")["blocks"]:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                for sp in l["spans"]:
                    if not sp["text"].strip(): continue
                    script = "Brittany" in sp["font"]
                    bx0, by0, bx1, by1 = sp["bbox"]
                    sz = sp["size"]
                    # month/year and sizeOf/fruit-name live on plate-pasted zones
                    if bx1 < 350 and by1 < 176: continue
                    if bx1 < 390 and 290 < by0 and by1 < 432: continue
                    if script:
                        # script swash tails scale with the font size
                        pl, pr = 4 + 0.05 * sz, 8 + 0.2 * sz
                        pt, pb = 4 + 0.1 * sz, 8 + 0.45 * sz
                    else:
                        pl, pr, pt, pb = 4, 5, 4, 6
                    # choose fill strategy by what the text sits on:
                    # - callout bar + notes clipboard: horizontally-uniform shapes
                    #   -> replicate-right
                    # - week badge blob: rounded caps -> horizontal L/R blend
                    #   (extra padding: the baked badge script has gradient ink)
                    # - everything else -> short-axis blend
                    if 640 < by0 < 748 and 450 < bx0 < 1120: mode = 'rep'
                    elif bx0 > 1150 and 560 < by0 < 650: mode = 'rep'
                    elif 195 < by0 < 265 and bx0 < 400:
                        mode = 'lerpH'; pl += 4; pr += 6; pt += 2; pb += 4
                    else: mode = 'lerp'
                    r = (s(bx0 - pl), s(by0 - pt), s(bx1 + pr), s(by1 + pb))
                    rects.append((r, mode))
        # erase; drop each rect from the mask once filled so later rects can
        # sample the (clean) fill right next to them instead of walking far
        mask = set(r for r, _ in rects)
        for r, mode in rects:
            if mode == 'rep': erase_replicate_right(base, *r, mask=mask)
            elif mode == 'lerpH': erase_interp(base, *r, mask=mask, force_horiz=True)
            else: erase_interp(base, *r, mask=mask)
            mask.discard(r)
        # remove baked Mama-list hearts (we render sprites of them); strip is
        # wide enough to take the whole heart but stays inside the card border
        erase_interp(base, s(1188), s(355), s(1217), s(640))
        # restore vector artwork the erases/pastes destroyed, ink-only (keyed):
        # 1. heart + sprig next to the month title
        for bb in month_decor_boxes(pg):
            restore_keyed(base, pristine, *bb)
        # 2. hearts, dot scatters, burst dashes around the fruit name — the
        #    fruit-zone plate paste wiped these vector accents
        for bb in path_clusters(pg, (2, 286, 394, 440), max_side=120):
            restore_keyed(base, pristine, *bb)
        # 3. the sparkle doodle next to the mid-column tip block
        tipx = [sp2["bbox"][0] for b2 in pg.get_text("dict")["blocks"] if b2.get("type") == 0
                for l2 in b2.get("lines", []) for sp2 in l2["spans"]
                if sp2["text"].strip() and 1130 < sp2["bbox"][0] < 1215 and 470 < sp2["bbox"][1] < 600]
        if tipx:
            for bb in path_clusters(pg, (1146, 466, min(tipx) - 3, 556), max_side=70):
                restore_keyed(base, pristine, *bb)
        # 4. the paperclip on the Notes clipboard (image over vector art) — the
        #    plain paste is fine here: clipboard fill matches the pristine
        for info in pg.get_image_info():
            x0, y0, x1, y1 = info['bbox']
            if 1150 < x0 < 1280 and 540 < y0 and y1 < 680 and (x1 - x0) < 25:
                box = (s(x0 - 4), s(y0 - 4), s(x1 + 4), s(y1 + 4))
                base.paste(pristine.crop(box), box[:2])
        ext = "jpg" if PRINT else "png"
        kw = dict(quality=96, subsampling=0) if PRINT else dict(quality=95)   # q96: crisper baked art
        base.save(apath(BASE_DIR, f"week-{week:02d}.{ext}"), **kw)   # (legacy baked bg; unused now)

        # Standardized template base: paste the CLEAN plate (no fruit, no wash) over
        # the whole fruit zone, wiping the fruit + wash blob + scattered decorations
        # (burst-dashes, dots, spiral, flower, hearts) to plain cream. Every week
        # reuses this and overlays its own fruit + a uniform soft wash at render time.
        FRUIT_ZONE = (s(4), s(332), s(396), s(694))     # x5..396, y332..694 (below name, above size icons ~710)
        tmpl_plate = Image.open(apath(PLATES_DIR, f"tmpl-{week:02d}.{ext}")).convert("RGB")
        tmpl = base.copy()
        paste_feathered(tmpl, tmpl_plate, FRUIT_ZONE)
        tmpl.save(apath(BASE_DIR, f"tmpl-{week:02d}.{ext}"), **kw)
    print("bases (+ clean templates): done")

if __name__ == "__main__":
    if not PRINT:
        extract_fruit()   # fruit comes from the XLSX at native res — scale-independent
    doc = fitz.open(PDF)
    build_plates_and_flower(doc)
    build_bases(doc)
    print(("PRINT " if PRINT else "") + "assets written to", os.path.join(ROOT, "assets"))
