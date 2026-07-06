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
import fitz, openpyxl, io, os, statistics
from PIL import Image, ImageDraw

PDF  = r"C:\Users\jawad\Downloads\Documents\Kopie von Pregnancy Calendar.pdf"
XLSX = r"C:\Users\jawad\Downloads\Pregnancy Calendar Overview.xlsx"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCALE = 2.0                       # 2x -> crisp 2880x1620 assets
MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]

def apath(*p):
    fp = os.path.join(ROOT, "assets", *p); os.makedirs(os.path.dirname(fp), exist_ok=True); return fp
def s(v): return int(round(v * SCALE))

def extract_fruit():
    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    for img in getattr(ws, "_images", []):
        row = img.anchor._from.row            # 0-based; sheet row 2 == week 4
        week = 4 + (row - 1)
        im = Image.open(io.BytesIO(img._data())).convert("RGBA")
        im.save(apath("fruit", f"week-{week:02d}.png"))
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

def build_plates_and_flower(doc):
    saved_flower = False
    for pi, week in enumerate(MILESTONES):
        pg = doc[pi]
        W, H = int(pg.rect.width * SCALE), int(pg.rect.height * SCALE)
        canvas = Image.new("RGBA", (W, H), (251, 247, 242, 255))
        for im in sorted(pg.get_image_info(xrefs=True),
                         key=lambda d: -((d['bbox'][2]-d['bbox'][0])*(d['bbox'][3]-d['bbox'][1]))):
            x0, y0, x1, y1 = im['bbox']; w, h = x1-x0, y1-y0
            cx, cy = (x0+x1)/2, (y0+y1)/2
            if im['xref'] <= 0: continue
            src = load_rgba(doc, im['xref'])
            is_flower = (w < 45 and h < 45 and 405 < cx < 1270 and 330 < cy < 640)
            if is_flower:
                if not saved_flower:
                    src.save(apath("deco", "flower.png")); saved_flower = True
                continue
            canvas.alpha_composite(src.resize((max(1, s(w)), max(1, s(h))), Image.LANCZOS),
                                   (s(x0), s(y0)))
        canvas.convert("RGB").save(apath("plates", f"week-{week:02d}.png"), quality=95)
    print("plates + flower: done")

def median_bg(px, x0, y0, x1, y1):
    pts = []
    for off in (5, 10):
        for x in range(int(x0-off), int(x1+off), 8):
            pts += [(x, int(y0-off)), (x, int(y1+off))]
        for y in range(int(y0-off), int(y1+off), 8):
            pts += [(int(x0-off), y), (int(x1+off), y)]
    cols = []
    for x, y in pts:
        try: cols.append(px[x, y])
        except Exception: pass
    if not cols: return (250, 246, 241)
    return tuple(int(statistics.median(c[i] for c in cols)) for i in range(3))

def build_bases(doc):
    MONTH_BOX = (s(52), s(26), s(346), s(172))     # month + year
    CAL_BOX   = (s(365), s(106), s(1152), s(666))  # whole calendar panel
    for pi, week in enumerate(MILESTONES):
        pg = doc[pi]
        pix = pg.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE))
        base = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        plate = Image.open(apath("plates", f"week-{week:02d}.png")).convert("RGB")
        px = base.load(); d = ImageDraw.Draw(base)
        # erase every text line (kept artwork + vector decorations)
        for b in pg.get_text("dict")["blocks"]:
            if b.get("type") != 0: continue
            for l in b.get("lines", []):
                if not "".join(sp["text"] for sp in l["spans"]).strip(): continue
                script = "Brittany" in l["spans"][0]["font"]
                x0, y0, x1, y1 = [v*SCALE for v in l["bbox"]]
                fill = median_bg(px, x0, y0, x1, y1)
                pl, pr, pt, pb = (12, 24, 12, 22) if script else (4, 6, 6, 9)
                d.rectangle([int(x0-pl), int(y0-pt), int(x1+pr), int(y1+pb)], fill=fill)
        # remove baked Mama-list hearts (we render our own bullets)
        d.rectangle([s(1183), s(360), s(1218), s(632)], fill=base.getpixel((s(1330), s(560))))
        # month/year -> clean artwork from the plate; calendar -> flat cell colour
        base.paste(plate.crop(MONTH_BOX), (MONTH_BOX[0], MONTH_BOX[1]))
        d.rectangle(CAL_BOX, fill=base.getpixel((s(430), s(250))))
        base.save(apath("base", f"week-{week:02d}.png"), quality=95)
    print("bases: done")

if __name__ == "__main__":
    extract_fruit()
    doc = fitz.open(PDF)
    build_plates_and_flower(doc)
    build_bases(doc)
    print("All assets written to", os.path.join(ROOT, "assets"))
