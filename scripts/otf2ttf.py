"""
Convert an OpenType/CFF font to TrueType (glyf) outlines.

Why: Chromium embeds CFF/OTF fonts into its printed PDF as *Type3* fonts, whose
glyphs many PDF viewers and print RIPs rasterize at low resolution — the body
serif (CMU Serif, cmunrm.otf) came out blurry. TrueType (glyf) fonts embed as
normal vector fonts (like Brittany/Open Sauce here), so they stay crisp.

    python scripts/otf2ttf.py public/fonts/cmunrm.otf public/fonts/cmunrm.ttf

Requires: fonttools (with cu2qu).
"""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

MAX_ERR = 1.0          # max approximation error in font units (1000 upem → sub-pixel)
POST_FORMAT = 2.0


def otf_to_ttf(src, dst):
    font = TTFont(src)
    if "glyf" in font:
        font.save(dst); return "already TrueType"

    glyph_order = font.getGlyphOrder()
    cff = font["CFF "].cff
    charstrings = cff[cff.fontNames[0]].CharStrings
    upem = font["head"].unitsPerEm

    glyf = newTable("glyf"); glyf.glyphOrder = glyph_order; glyf.glyphs = {}
    for name in glyph_order:
        pen = TTGlyphPen(None)
        # cu2qu wraps the TT pen and converts cubic CFF curves → quadratic TT curves
        charstrings[name].draw(Cu2QuPen(pen, MAX_ERR * upem / 1000.0, reverse_direction=True))
        glyf[name] = pen.glyph()

    font["glyf"] = glyf
    # loca is built from glyf on compile; add the tables TrueType needs
    from fontTools.ttLib.tables._l_o_c_a import table__l_o_c_a
    font["loca"] = table__l_o_c_a()

    maxp = font["maxp"]; maxp.tableVersion = 0x00010000
    maxp.maxZones = 1; maxp.maxTwilightPoints = 0
    maxp.maxStorage = 0; maxp.maxFunctionDefs = 0; maxp.maxInstructionDefs = 0
    maxp.maxStackElements = 0; maxp.maxSizeOfInstructions = 0
    maxp.maxComponentElements = max((len(getattr(g, "components", [])) for g in glyf.glyphs.values()), default=0)

    post = font["post"]; post.formatType = POST_FORMAT
    post.extraNames = []; post.mapping = {}; post.glyphOrder = glyph_order

    font.sfntVersion = "\000\001\000\000"     # 'true' TrueType
    for t in ("CFF ", "VORG"):
        if t in font: del font[t]
    font.save(dst)
    return f"converted {len(glyph_order)} glyphs, upem {upem}"


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    print(otf_to_ttf(src, dst))
