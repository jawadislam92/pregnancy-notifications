"""
Generates src/design.js — exact per-week layout geometry harvested from the
approved Canva PDF. Run once (and re-run only if the design PDF changes):

    python scripts/gen_design.py

Everything the renderer positions (text anchors, calendar frame, column
boundaries, row lines, sizes) comes from the PDF's own text spans and vector
drawings, so the output matches the approved design exactly instead of
hand-tuned coordinates.
"""
import fitz, io, json, os, re
from PIL import Image

PDF = r"C:\Users\jawad\Downloads\Documents\canva.pdf"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "design.js")

MILESTONES = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]
MONTHS = ['January','February','March','April','May','June','July','August','September','October']
FRUITS = ['Poppy seed','Raspberry','Lemon','Apple','Carrot','Cauliflower','Pineapple',
          'Chinese cabbage','Pointed cabbage','Large pumpkin']

def harvest():
    d = fitz.open(PDF)
    design = {}
    for pi, wk in enumerate(MILESTONES):
        pg = d[pi]
        spans = []
        for b in pg.get_text('dict')['blocks']:
            if b.get('type') != 0: continue
            for l in b.get('lines', []):
                for s in l['spans']:
                    t = s['text'].strip()
                    if not t: continue
                    spans.append({'t': t, 'x0': round(s['bbox'][0], 1), 'y0': round(s['bbox'][1], 1),
                                  'x1': round(s['bbox'][2], 1), 'y1': round(s['bbox'][3], 1),
                                  'sz': round(s['size'], 1), 'f': s['font'],
                                  'c': '#%06x' % s['color']})
        def find(pred):
            for s in spans:
                if pred(s): return s
        def allof(pred): return [s for s in spans if pred(s)]
        def C(s): return round((s['x0'] + s['x1']) / 2, 1)

        # ---- calendar frame / columns / row lines (vector drawings) ----
        frame = None; cols = set(); rows = set()
        for dr in pg.get_drawings():
            for it in dr['items']:
                if it[0] != 're': continue
                r = it[1]
                x0, y0, x1, y1 = round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)
                w, h = x1 - x0, y1 - y0
                if w > 700 and h > 500 and 350 < x0 < 400:
                    if frame is None or w * h > (frame[2] - frame[0]) * (frame[3] - frame[1]):
                        frame = (x0, y0, x1, y1)
                if w < 9 and h > 300 and 400 < x0 < 1140: cols.add(round((x0 + x1) / 2, 1))
                if w > 300 and h < 3 and 350 < x0 < 400: rows.add(round((y0 + y1) / 2, 1))
        merged = []
        for c in sorted(cols):
            if merged and abs(c - merged[-1]) < 12: merged[-1] = (merged[-1] + c) / 2
            else: merged.append(c)
        cols = [round(c, 1) for c in merged]
        rows = sorted(rows)

        # ---- raster samples: frame stroke + cell fill colours ----
        pix = pg.get_pixmap(matrix=fitz.Matrix(2, 2))
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')
        def rgbat(x, y): return im.getpixel((int(x * 2), int(y * 2)))
        def hexat(x, y): return '#%02x%02x%02x' % rgbat(x, y)
        # frame stroke: darkest pixel in a small vertical probe across the top edge
        sx = int(((frame[0] + frame[2]) / 2 - 200) * 2)
        probe = [im.getpixel((sx, int(frame[1] * 2) + dy)) for dy in range(-3, 5)]
        stroke = '#%02x%02x%02x' % min(probe, key=sum)
        cell = hexat(frame[0] + 50, rows[0] + 40)                   # empty first-row cell
        # highlight band: vector fill colour + effective alpha (the design paints
        # translucent fills, so grid lines show through on most pages)
        bandC = None
        for dr in pg.get_drawings():
            for it in dr['items']:
                if it[0] != 're': continue
                r = it[1]
                if (r.x1 - r.x0) > 300 and 60 < (r.y1 - r.y0) < 120 and r.y0 > 300 and dr.get('fill'):
                    f = dr['fill']
                    if f != (0.0, 0.0, 0.0):
                        bandC = tuple(int(v * 255) for v in f); break
            if bandC: break
        band = None
        if bandC:
            flat = rgbat(900, 390)                                  # inside rows-3 band, no text
            cel = rgbat(frame[0] + 100, rows[0] + 40)
            ratios = [(flat[i] - cel[i]) / (bandC[i] - cel[i]) for i in range(3) if abs(bandC[i] - cel[i]) > 12]
            a = round(min(1.0, max(0.15, sum(ratios) / len(ratios))), 2) if ratios else 1.0
            band = {'c': '#%02x%02x%02x' % bandC, 'a': a}

        m  = find(lambda s: s['t'] == MONTHS[pi])
        yr = find(lambda s: re.fullmatch(r'20\d\d', s['t']))
        bd = find(lambda s: 'of Pregnancy' in s['t'])
        fr = find(lambda s: s['t'] == FRUITS[pi])
        so = find(lambda s: s['t'] == 'Baby is the size of')
        bsl = find(lambda s: s['t'] == 'Baby Size'); bwl = find(lambda s: s['t'] == 'Baby Weight')
        vals = sorted(allof(lambda s: s['y0'] > 745 and s['x0'] < 350 and 12 < s['sz'] < 17
                            and not s['f'].startswith('CMUSerif')), key=lambda s: s['x0'])
        tiny = find(lambda s: s['t'] == 'Tiny moments')
        dev  = find(lambda s: s['t'] == 'Baby Development')
        mama = find(lambda s: s['t'] == 'Mama may notice')
        notes = find(lambda s: s['t'] == 'Notes & Memories')
        devb = allof(lambda s: s['f'].startswith('CMUSerif') and s['sz'] < 14
                     and s['x0'] > 1190 and (dev is None or s['y0'] > dev['y0'] + 12)
                     and (mama is None or s['y0'] < mama['y0'] - 8))
        # design's mid-column tip block (Preparation Tip / Reminder / question),
        # sits between the Mama card and the Notes clipboard on some pages
        tip = allof(lambda s: s['f'].startswith('CMUSerif') and s['sz'] < 15
                    and 1130 < s['x0'] < 1215 and 470 < s['y0'] < 600)
        bulls = allof(lambda s: s['f'].startswith('CMUSerif') and abs(s['sz'] - 12.0) < 0.3
                      and s['x0'] > 1215 and mama and s['y0'] > mama['y0'] + 20)
        cl = find(lambda s: 'Brittany' in s['f'] and 640 < s['y0'] < 730 and 450 < s['x0'] < 700)
        ct = allof(lambda s: s['f'].startswith('CMUSerif') and s['sz'] > 16 and 640 < s['y0'] < 745 and s['x0'] > 600)
        wd = allof(lambda s: s['t'] in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'))
        nums = allof(lambda s: re.fullmatch(r'\d\d', s['t']) and s['f'].endswith('Bold'))
        firstnum = min(nums, key=lambda s: (s['y0'], s['x0'])) if nums else None
        # number offset within its cell (from nearest column boundary / row line)
        bounds = [frame[0]] + cols + [frame[2]]
        ndx = ndy = None
        if firstnum:
            leftb = max(b for b in bounds if b <= firstnum['x0'] + 0.1)
            topr  = max([frame[1]] + [r for r in rows if r <= firstnum['y0'] + 0.1])
            ndx, ndy = round(firstnum['x0'] - leftb, 1), round(firstnum['y0'] - topr, 1)

        if ct:
            ys = sorted(set(s['y0'] for s in ct))
            ctext = {'x': min(s['x0'] for s in ct), 'y': ys[0], 'sz': ct[0]['sz'],
                     'lh': round(ys[1] - ys[0], 1) if len(ys) > 1 else 20.3}
        else:  # wk36/40: spans not tagged the same way — derive from the label
            ctext = {'x': round(cl['x1'] + 16, 1), 'y': round(cl['y0'] - 5, 1), 'sz': 18.7, 'lh': 20.3}

        # riddle answers get their own line (and on wk12, their own colour)
        ans = find(lambda s: s['t'].startswith('Answer') and 650 < s['y0'] < 748)
        design[wk] = {
            'frame': list(frame), 'cols': cols, 'rows': rows,
            'stroke': stroke, 'cell': cell, 'band': band,
            'weekdayY': round(sum(s['y0'] for s in wd) / len(wd), 1) if wd else None,
            'num': {'dx': ndx or 7.7, 'dy': ndy or 5.3, 'sz': firstnum['sz'] if firstnum else 23.6},
            'month': {'cx': C(m), 'y': m['y0'], 'sz': m['sz']},
            'year': {'x': yr['x0'], 'y': yr['y0'], 'sz': yr['sz'], 'c': yr['c']},
            'badge': {'cx': C(bd), 'y': bd['y0'], 'sz': bd['sz']},
            'sizeOf': {'cx': C(so), 'y': so['y0'], 'sz': so['sz'], 'c': so['c']},
            'fruit': {'cx': C(fr), 'y': fr['y0'], 'sz': fr['sz']},
            'babySizeLbl': {'cx': C(bsl), 'y': bsl['y0'], 'sz': bsl['sz'], 'c': bsl['c']},
            'babyWeightLbl': {'cx': C(bwl), 'y': bwl['y0'], 'sz': bwl['sz'], 'c': bwl['c']},
            'babySizeVal': {'cx': C(vals[0]), 'y': vals[0]['y0'], 'sz': vals[0]['sz'], 'c': vals[0]['c']} if vals
                           else {'cx': C(bsl), 'y': round(bsl['y0'] + 86.1, 1), 'sz': 14.7, 'c': bsl['c']},
            'babyWeightVal': {'cx': C(vals[1]), 'y': vals[1]['y0'], 'sz': vals[1]['sz'], 'c': vals[1]['c']} if len(vals) > 1
                             else {'cx': C(bwl), 'y': round(bwl['y0'] + 86.1, 1), 'sz': 14.7, 'c': bwl['c']},
            'tiny': {'x': tiny['x0'], 'y': tiny['y0'], 'sz': tiny['sz'], 'c': tiny['c']},
            'devHdr': {'x': dev['x0'], 'y': dev['y0'], 'sz': dev['sz'], 'c': dev['c']},
            'devBody': {'x': min(s['x0'] for s in devb), 'y': min(s['y0'] for s in devb),
                        'w': round(max(s['x1'] for s in devb) - min(s['x0'] for s in devb) + 3, 1),
                        'lh': round(sorted(set(s['y0'] for s in devb))[1] - sorted(set(s['y0'] for s in devb))[0], 1)
                              if len(set(s['y0'] for s in devb)) > 1 else 16.5}
                       if devb else {'x': 1200.7, 'y': round(dev['y0'] + 37, 1), 'w': 182, 'lh': 16.6},
            'mamaHdr': {'x': mama['x0'], 'y': mama['y0'], 'sz': mama['sz'], 'c': mama['c']},
            'bullets': {'x': bulls[0]['x0'], 'y': min(s['y0'] for s in bulls)} if bulls else None,
            'notes': {'x': notes['x0'], 'y': notes['y0'], 'sz': notes['sz'], 'c': notes['c']},
            'calloutLabel': {'x': cl['x0'], 'y': cl['y0'], 'sz': max(cl['sz'], 21.5), 'x1': cl['x1'], 'c': cl['c']},
            'calloutText': dict(ctext, c=(ct[0]['c'] if ct else '#67698e')),
            'answerC': ans['c'] if ans else None,
            'tipPos': {'x': min(s['x0'] for s in tip), 'y': min(s['y0'] for s in tip),
                       'w': round(max(s['x1'] for s in tip) - min(s['x0'] for s in tip) + 3, 1)}
                      if tip else None,
        }
    return design

if __name__ == '__main__':
    design = harvest()
    js = ("// AUTO-GENERATED by scripts/gen_design.py from the approved Canva PDF.\n"
          "// Per-week layout geometry (1440x810 design space). Do not edit by hand —\n"
          "// re-run the generator if the design changes.\n"
          "module.exports = " + json.dumps(design, indent=1) + ";\n")
    open(OUT, 'w', encoding='utf-8').write(js)
    print('wrote', OUT, len(js), 'bytes')
