# report.py
import io
import base64
import cv2
import numpy as np
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, HRFlowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage


def base64_to_pil(b64_str: str) -> PILImage.Image:
    img_data = base64.b64decode(b64_str)
    return PILImage.open(io.BytesIO(img_data)).convert('RGB')


def pil_to_reportlab(pil_img: PILImage.Image, width_mm: float, height_mm: float) -> Image:
    buf = io.BytesIO()
    pil_img.save(buf, format='PNG')
    buf.seek(0)
    return Image(buf, width=width_mm*mm, height=height_mm*mm)


def generate_report(result: dict, filename: str = None) -> bytes:
    """
    분석 결과를 PDF 보고서로 생성
    result: predict() 함수 반환값 + base64 이미지들
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm,
    )

    # 폰트 등록 (한국어 지원)
    try:
        pdfmetrics.registerFont(TTFont('NanumGothic', 'NanumGothic.ttf'))
        font_name = 'NanumGothic'
    except:
        font_name = 'Helvetica'

    styles = getSampleStyleSheet()

    # 스타일 정의
    title_style = ParagraphStyle(
        'Title', fontName=font_name, fontSize=20,
        textColor=colors.HexColor('#1a1a2e'),
        spaceAfter=4*mm, alignment=1
    )
    subtitle_style = ParagraphStyle(
        'Subtitle', fontName=font_name, fontSize=11,
        textColor=colors.HexColor('#666666'),
        spaceAfter=8*mm, alignment=1
    )
    section_style = ParagraphStyle(
        'Section', fontName=font_name, fontSize=13,
        textColor=colors.HexColor('#1a1a2e'),
        spaceBefore=6*mm, spaceAfter=3*mm,
        borderPad=2, leftIndent=0,
    )
    body_style = ParagraphStyle(
        'Body', fontName=font_name, fontSize=10,
        textColor=colors.HexColor('#333333'),
        spaceAfter=2*mm, leading=16,
    )
    disclaimer_style = ParagraphStyle(
        'Disclaimer', fontName=font_name, fontSize=8,
        textColor=colors.HexColor('#999999'),
        spaceAfter=2*mm, leading=12,
    )

    story = []

    # ── 헤더 ──────────────────────────────────────────
    story.append(Paragraph('ArtiFix', title_style))
    story.append(Paragraph('유물 표면 손상 감지 분석 보고서', subtitle_style))
    story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#1a1a2e')))
    story.append(Spacer(1, 4*mm))

    # 분석 일시
    now = datetime.now().strftime('%Y년 %m월 %d일 %H:%M')
    story.append(Paragraph(f'분석 일시: {now}', body_style))
    story.append(Spacer(1, 4*mm))

    # ── 분석 요약 ──────────────────────────────────────
    story.append(Paragraph('■ 분석 요약', section_style))

    severity = result.get('severity', 'NONE')
    severity_color = {
        'HIGH':   '#e74c3c',
        'MEDIUM': '#f39c12',
        'LOW':    '#27ae60',
        'NONE':   '#95a5a6',
    }.get(severity, '#95a5a6')

    damage_ratio = result.get('damage_ratio', 0)
    bbox_count   = result.get('bbox_count', 0)
    labels       = result.get('labels', {})

    summary_data = [
        ['항목', '결과'],
        ['손상 심각도', severity],
        ['손상 면적 비율', f'{damage_ratio:.1f}%'],
        ['손상 영역 수', f'{bbox_count}개'],
        ['균열 (Crack)',         f'{labels.get("crack", 0)*100:.1f}%'],
        ['표면 손상 (Surface)',   f'{labels.get("surface_damage", 0)*100:.1f}%'],
        ['변색 (Discoloration)', f'{labels.get("discoloration", 0)*100:.1f}%'],
    ]

    summary_table = Table(summary_data, colWidths=[70*mm, 90*mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND',  (0, 0), (-1, 0),  colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR',   (0, 0), (-1, 0),  colors.white),
        ('FONTNAME',    (0, 0), (-1, -1), font_name),
        ('FONTSIZE',    (0, 0), (-1, -1), 10),
        ('ALIGN',       (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
        ('GRID',        (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
        ('ROWHEIGHT',   (0, 0), (-1, -1), 8*mm),
        ('TEXTCOLOR',   (1, 1), (1, 1),   colors.HexColor(severity_color)),
        ('FONTNAME',    (1, 1), (1, 1),   font_name),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 6*mm))

    # ── 이미지 결과 ────────────────────────────────────
    story.append(Paragraph('■ 분석 이미지', section_style))

    images_row = []
    labels_row = []

    image_keys = [
        ('original_image', '원본 이미지'),
        ('mask_image',     '손상 마스크'),
        ('overlay_image',  '오버레이'),
        ('gradcam_image',  'Grad-CAM'),
    ]

    for key, label in image_keys:
        if key in result and result[key]:
            try:
                pil_img = base64_to_pil(result[key])
                pil_img = pil_img.resize((256, 256))
                rl_img  = pil_to_reportlab(pil_img, 38, 38)
                images_row.append(rl_img)
                labels_row.append(Paragraph(label, ParagraphStyle(
                    'ImgLabel', fontName=font_name, fontSize=8,
                    alignment=1, textColor=colors.HexColor('#666666')
                )))
            except:
                pass

    if images_row:
        img_table = Table([images_row, labels_row])
        img_table.setStyle(TableStyle([
            ('ALIGN',  (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 2*mm),
        ]))
        story.append(img_table)
    story.append(Spacer(1, 6*mm))

    # ── 손상 영역 상세 ─────────────────────────────────
    bboxes = result.get('bboxes', [])
    if bboxes:
        story.append(Paragraph('■ 손상 영역 상세', section_style))

        bbox_data = [['영역', 'X', 'Y', '너비', '높이', '면적 (px)']]
        for idx, bbox in enumerate(bboxes[:10]):
            bbox_data.append([
                f'Region {idx+1}',
                str(bbox.get('x', 0)),
                str(bbox.get('y', 0)),
                str(bbox.get('w', 0)),
                str(bbox.get('h', 0)),
                f'{bbox.get("area", 0):.0f}',
            ])

        bbox_table = Table(bbox_data, colWidths=[25*mm, 25*mm, 25*mm, 25*mm, 25*mm, 30*mm])
        bbox_table.setStyle(TableStyle([
            ('BACKGROUND',     (0, 0), (-1, 0),  colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR',      (0, 0), (-1, 0),  colors.white),
            ('FONTNAME',       (0, 0), (-1, -1), font_name),
            ('FONTSIZE',       (0, 0), (-1, -1), 9),
            ('ALIGN',          (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',         (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8f9fa'), colors.white]),
            ('GRID',           (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('ROWHEIGHT',      (0, 0), (-1, -1), 7*mm),
        ]))
        story.append(bbox_table)
        story.append(Spacer(1, 6*mm))

    # ── 면책 조항 ──────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#cccccc')))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        '본 보고서는 ArtiFix AI 시스템에 의해 자동 생성된 분석 결과입니다. '
        '실제 문화재 보존 처리 및 복원 작업에는 전문 보존처리사의 판단이 필요하며, '
        '본 결과는 참고 자료로만 활용하시기 바랍니다.',
        disclaimer_style
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()