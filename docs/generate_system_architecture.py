"""Generate docs/system_architecture.png for README."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 2
FONT_DIR = Path(r"C:\Windows\Fonts")
OUT = Path(__file__).resolve().parent / "system_architecture.png"

C = {
    "blue_fill": (232, 240, 254),
    "blue_stroke": (26, 115, 232),
    "blue_text": (21, 88, 176),
    "purple_fill": (238, 237, 254),
    "purple_stroke": (83, 74, 183),
    "purple_text": (60, 52, 137),
    "green_fill": (225, 245, 238),
    "green_stroke": (15, 110, 86),
    "green_text": (8, 80, 65),
    "gray": (100, 99, 94),
    "label": (95, 94, 90),
    "white": (255, 255, 255),
    "legend": (248, 248, 246),
    "arrow": (90, 89, 85),
}

# Main diagram must stay left of legend panel.
DIAGRAM_RIGHT = 636
LEGEND_LEFT = 648


def s(v: float) -> int:
    return int(v * SCALE)


W, H = s(920), s(460)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "malgunbd.ttf" if bold else "malgun.ttf"
    return ImageFont.truetype(str(FONT_DIR / name), s(size))


class Box:
    __slots__ = ("x0", "y0", "x1", "y1", "fill", "stroke", "title", "subtitle")

    def __init__(self, x0, y0, x1, y1, fill, stroke, title, subtitle=None):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1
        self.fill, self.stroke = fill, stroke
        self.title, self.subtitle = title, subtitle

    @property
    def cx(self):
        return (self.x0 + self.x1) // 2

    @property
    def cy(self):
        return (self.y0 + self.y1) // 2

    @property
    def top(self):
        return self.y0

    @property
    def bottom(self):
        return self.y1

    @property
    def left(self):
        return self.x0

    @property
    def right(self):
        return self.x1


def draw_box(draw, box: Box, tf, sf, tc, sc):
    draw.rounded_rectangle(
        (s(box.x0), s(box.y0), s(box.x1), s(box.y1)),
        radius=s(8),
        fill=box.fill,
        outline=box.stroke,
        width=s(2),
    )
    cx, cy = s(box.cx), s(box.cy)
    if box.subtitle:
        draw.text((cx, cy - s(10)), box.title, fill=tc, font=tf, anchor="mm")
        draw.text((cx, cy + s(10)), box.subtitle, fill=sc, font=sf, anchor="mm")
    else:
        draw.text((cx, cy), box.title, fill=tc, font=tf, anchor="mm")


def draw_group(draw, xy, title, color, fnt):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle((s(x0), s(y0), s(x1), s(y1)), radius=s(10), outline=color, width=s(2))
    draw.text((s(x0 + 14), s(y0 + 12)), title, fill=color, font=fnt)


def _tip(draw, x, y, direction, size=7):
    size = s(size)
    x, y = s(x), s(y)
    tips = {
        "down": [(x, y), (x - size, y - size), (x + size, y - size)],
        "up": [(x, y), (x - size, y + size), (x + size, y + size)],
        "right": [(x, y), (x - size, y - size), (x - size, y + size)],
        "left": [(x, y), (x + size, y - size), (x + size, y + size)],
    }
    draw.polygon(tips[direction], fill=C["arrow"])


def line_seg(draw, p0, p1, width=2):
    draw.line([(s(p0[0]), s(p0[1])), (s(p1[0]), s(p1[1]))], fill=C["arrow"], width=s(width))


def arrow_v(draw, x, y0, y1):
    if y1 > y0:
        line_seg(draw, (x, y0), (x, y1 - 6))
        _tip(draw, x, y1, "down")
    else:
        line_seg(draw, (x, y0), (x, y1 + 6))
        _tip(draw, x, y1, "up")


def arrow_h(draw, x0, x1, y):
    if x1 > x0:
        line_seg(draw, (x0, y), (x1 - 6, y))
        _tip(draw, x1, y, "right")
    else:
        line_seg(draw, (x0, y), (x1 + 6, y))
        _tip(draw, x1, y, "left")


def polyline(draw, points, arrow_end=False):
    for i in range(len(points) - 1):
        p0, p1 = points[i], points[i + 1]
        last = i == len(points) - 2
        if last and arrow_end:
            if p0[0] == p1[0]:
                arrow_v(draw, p0[0], p0[1], p1[1])
            elif p0[1] == p1[1]:
                arrow_h(draw, p0[0], p1[0], p0[1])
            else:
                line_seg(draw, p0, p1)
        else:
            line_seg(draw, p0, p1)


def label(draw, text, x, y, fnt):
    x, y = s(x), s(y)
    bbox = draw.textbbox((x, y), text, font=fnt, anchor="mm")
    pad = s(4)
    draw.rounded_rectangle(
        (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad),
        radius=s(4),
        fill=C["white"],
        outline=C["gray"],
        width=1,
    )
    draw.text((x, y), text, fill=C["label"], font=fnt, anchor="mm")


def main():
    img = Image.new("RGB", (W, H), C["white"])
    draw = ImageDraw.Draw(img)
    f14b, f12, f11 = font(14, True), font(12), font(11)

    upload = Box(36, 52, 196, 98, C["blue_fill"], C["blue_stroke"], "이미지 업로드", "카메라")
    options = Box(216, 52, 376, 98, C["blue_fill"], C["blue_stroke"], "분석 옵션", "모델 / Crop")
    viewer = Box(456, 52, 616, 98, C["blue_fill"], C["blue_stroke"], "결과 뷰어", "3D / PDF")

    predict = Box(176, 168, 336, 204, C["purple_fill"], C["purple_stroke"], "POST /predict")
    report = Box(456, 168, 616, 204, C["purple_fill"], C["purple_stroke"], "POST /report")
    inference = Box(156, 224, 356, 258, C["purple_fill"], C["purple_stroke"], "inference.py")
    report_py = Box(456, 224, 616, 258, C["purple_fill"], C["purple_stroke"], "report.py")

    base = Box(96, 324, 276, 368, C["green_fill"], C["green_stroke"], "best_model.pt", "Classification")
    finetuned = Box(316, 324, 496, 368, C["green_fill"], C["green_stroke"], "best_finetuned.pt", "Segmentation")

    boxes = [upload, options, viewer, predict, report, inference, report_py, base, finetuned]

    # ── 1) Group outlines ──
    draw_group(draw, (24, 24, DIAGRAM_RIGHT, 112), "Frontend · React + Vite", C["blue_text"], f14b)
    draw_group(draw, (24, 140, DIAGRAM_RIGHT, 278), "Backend · FastAPI", C["purple_text"], f14b)
    draw_group(draw, (24, 296, DIAGRAM_RIGHT, 388), "PyTorch 가중치", C["green_text"], f14b)

    # ── 2) Arrows (under boxes) ──
    bus_y = 118

    # ① 업로드 + 옵션 → /predict
    arrow_v(draw, upload.cx, upload.bottom, bus_y)
    arrow_v(draw, options.cx, options.bottom, bus_y)
    line_seg(draw, (upload.cx, bus_y), (options.cx, bus_y))
    arrow_v(draw, predict.cx, bus_y, predict.top)

    # ② /predict → inference
    arrow_v(draw, predict.cx, predict.bottom, inference.top)

    # ③ inference → 가중치
    split_y = 292
    arrow_v(draw, inference.cx, inference.bottom, split_y)
    line_seg(draw, (base.cx, split_y), (finetuned.cx, split_y))
    arrow_v(draw, base.cx, split_y, base.top)
    arrow_v(draw, finetuned.cx, split_y, finetuned.top)

    # ④ JSON: inference → 왼쪽 여백 → viewer (블록 관통 없음)
    lane_left = 108
    top_lane = 82
    polyline(
        draw,
        [
            (inference.right, inference.cy),
            (lane_left, inference.cy),
            (lane_left, top_lane),
            (viewer.cx, top_lane),
            (viewer.cx, viewer.top),
        ],
        arrow_end=True,
    )
    label(draw, "JSON 응답", lane_left + 52, top_lane - 12, f11)

    # ⑤ PDF 요청: viewer → /report (같은 열, 위→아래)
    pdf_lane = viewer.cx
    polyline(
        draw,
        [
            (pdf_lane, viewer.bottom),
            (pdf_lane, 128),
            (pdf_lane, report.top),
        ],
        arrow_end=True,
    )
    label(draw, "PDF 요청", pdf_lane + 58, 125, f11)

    # ⑥ /report → report.py
    arrow_v(draw, report.cx, report.bottom, report_py.top)

    # ⑦ report.py → inference (가로, 두 블록 사이)
    bridge_y = report_py.cy
    arrow_h(draw, report_py.left, inference.right, bridge_y)
    label(draw, "재분석", (report_py.left + inference.right) // 2, bridge_y - 14, f11)

    # ⑧ PDF 반환: report.py → 오른쪽 여백 → viewer (블록·패널 관통 없음)
    lane_right = 628
    polyline(
        draw,
        [
            (report_py.right, report_py.cy),
            (lane_right, report_py.cy),
            (lane_right, top_lane),
            (viewer.right, top_lane),
            (viewer.right, viewer.top),
        ],
        arrow_end=True,
    )
    label(draw, "PDF 반환", lane_right - 36, top_lane - 12, f11)

    # ── 3) Boxes on top of arrows ──
    for b in (upload, options, viewer):
        draw_box(draw, b, f14b, f11, C["blue_text"], C["blue_stroke"])
    for b in (predict, report, inference, report_py):
        draw_box(draw, b, f14b if b in (predict, report) else f12, f11, C["purple_text"], C["purple_text"])
    for b in (base, finetuned):
        draw_box(draw, b, f14b, f11, C["green_text"], C["green_stroke"])

    # ── 4) Legend ──
    lx0, ly0, lx1, ly1 = LEGEND_LEFT, 24, 896, 388
    draw.rounded_rectangle((s(lx0), s(ly0), s(lx1), s(ly1)), radius=s(10), fill=C["legend"], outline=C["gray"], width=1)
    draw.text((s(lx0 + 16), s(ly0 + 14)), "요청 흐름", fill=C["label"], font=f14b)

    steps = [
        ("①", "업로드 + 옵션 → POST /predict"),
        ("②", "inference.py 추론"),
        ("③", "PyTorch 가중치 로드"),
        ("④", "JSON 응답 → 결과 뷰어"),
        ("⑤", "PDF 요청 → POST /report"),
        ("⑥", "report.py + inference"),
        ("⑦", "PDF 파일 → 결과 뷰어"),
    ]
    y = ly0 + 44
    for num, text in steps:
        draw.text((s(lx0 + 16), s(y)), num, fill=C["blue_stroke"], font=f14b)
        draw.text((s(lx0 + 40), s(y)), text, fill=C["label"], font=f11)
        y += 46

    img.save(OUT, "PNG")
    print(f"Saved {OUT}")


if __name__ == "__main__":
    main()
