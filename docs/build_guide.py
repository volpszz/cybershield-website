"""Render the Portuguese project handbook. Run with reportlab installed.
Usage: python docs/build_guide.py
Code snippets are read from the actual project, never manually duplicated.
"""
from pathlib import Path
import re
from html import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, Table, TableStyle, KeepTogether, Image, Flowable, CondPageBreak
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
FONT_DIR = Path('C:/Windows/Fonts')
for name, file in [('Guide','segoeui.ttf'), ('GuideBold','segoeuib.ttf'), ('GuideMono','consola.ttf')]:
    if (FONT_DIR/file).exists():
        pdfmetrics.registerFont(TTFont(name, str(FONT_DIR/file)))
BODY = 'Guide' if 'Guide' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
BOLD = 'GuideBold' if 'GuideBold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
MONO = 'GuideMono' if 'GuideMono' in pdfmetrics.getRegisteredFontNames() else 'Courier'
pdfmetrics.registerFontFamily(BODY, normal=BODY, bold=BOLD, italic=BODY, boldItalic=BOLD)
NAVY = colors.HexColor('#11263A')
TEAL = colors.HexColor('#007D80')
MUTED = colors.HexColor('#526679')
LIGHT = colors.HexColor('#EDF5F7')
styles = {
    'body': ParagraphStyle('body', fontName=BODY, fontSize=10, leading=14, textColor=NAVY, spaceAfter=7),
    'h1': ParagraphStyle('h1', fontName=BOLD, fontSize=24, leading=29, textColor=NAVY, spaceAfter=15, keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName=BOLD, fontSize=14, leading=18, textColor=TEAL, spaceBefore=11, spaceAfter=7, keepWithNext=True),
    'code': ParagraphStyle('code', fontName=MONO, fontSize=7.3, leading=10, textColor=NAVY, backColor=LIGHT, borderPadding=8, spaceAfter=9),
    'label': ParagraphStyle('label', fontName=BOLD, fontSize=9, leading=13, textColor=TEAL, spaceAfter=7),
    'cover': ParagraphStyle('cover', fontName=BOLD, fontSize=39, leading=44, textColor=NAVY, spaceAfter=25),
}

def inline(text):
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'`([^`]+)`', lambda m: '<font name="'+MONO+'">'+m.group(1)+'</font>', text)
    return text

class GuideCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.saved_states = []
    def showPage(self):
        self.saved_states.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        count = len(self.saved_states)
        for state in self.saved_states:
            self.__dict__.update(state)
            width, height = A4
            self.setStrokeColor(TEAL)
            self.setLineWidth(1)
            self.line(44, height-35, width-44, height-35)
            self.setFillColor(MUTED)
            self.setFont(BODY, 8)
            self.drawString(44, height-27, 'CYBERSHIELD / LABORATORIO FULL STACK')
            self.drawString(44, 27, 'Do navegador ao banco de dados | Guia em portugues')
            self.drawRightString(width-44, 27, f'{self._pageNumber:02d} / {count:02d}')
            super().showPage()
        super().save()


def add_code(story, text):
    # Wrap unusually long lines so excerpts never run beyond the page edge.
    lines = []
    for line in text.expandtabs(4).splitlines():
        while len(line)>85:
            cut = line.rfind(' ', 0, 83)
            if cut<25: cut=83
            lines.append(line[:cut])
            line = '    '+line[cut:].lstrip()
        lines.append(line)
    # Smaller chunks let page breaks occur between lines, not outside page bounds.
    for start in range(0, len(lines), 25):
        story.append(Preformatted('\n'.join(lines[start:start+25]), styles['code']))


class Architecture(Flowable):
    def __init__(self):
        super().__init__(); self.width=500; self.height=185
    def draw(self):
        c=self.canv
        boxes=[(0,'NAVEGADOR','HTML / CSS / JS'),(180,'SERVIDOR','Express / regras'),(360,'BANCO','SQLite / dados')]
        for x,title,subtitle in boxes:
            c.setFillColor(LIGHT); c.setStrokeColor(TEAL)
            c.roundRect(x,77,140,75,8,fill=1,stroke=1)
            c.setFillColor(NAVY); c.setFont(BOLD,11); c.drawCentredString(x+70,121,title)
            c.setFont(BODY,9); c.drawCentredString(x+70,101,subtitle)
        c.setStrokeColor(TEAL);c.setLineWidth(1.4)
        for a,b in [(142,178),(322,358)]:
            c.line(a,123,b,123);c.line(b-5,127,b,123);c.line(b-5,119,b,123)
            c.line(b,104,a,104);c.line(a+5,108,a,104);c.line(a+5,100,a,104)
        c.setFont(BODY,8);c.setFillColor(MUTED)
        c.drawCentredString(160,160,'HTTP + JSON');c.drawCentredString(340,160,'SQL')
        c.drawString(0,48,'O navegador nunca recebe acesso direto ao arquivo do banco.')
        c.drawString(0,29,'Somente public/ e servido. backend/ e docs/ ficam fora da area publica.')


def build():
    source = DOCS/'Guia-CyberShield.md'
    text = source.read_text(encoding='utf-8')
    story = []
    story += [Spacer(1,65), Paragraph('UM PROJETO. TODAS AS CAMADAS.',styles['label']),
        Paragraph('CyberShield<br/>Da interface<br/>ao servidor.', styles['cover']),
        Paragraph('Um guia pratico de desenvolvimento web para quem ja programa e quer entender o caminho completo de uma aplicacao.', styles['body']),
        Spacer(1,25), Paragraph('HTML + CSS + JavaScript / Node.js + Express / SQLite',styles['h2']),
        Paragraph('Interface em ingles. Explicacoes em portugues. Exemplos retirados dos arquivos reais deste projeto.',styles['body']),
        Spacer(1,25), Paragraph('Este material descreve uma aplicacao local de estudo. Nao e um servico de seguranca em operacao nem uma certificacao de prontidao para producao.',styles['body']), PageBreak()]
    headings = re.findall(r'^# (.+)$',text,re.M)
    story.append(Paragraph('Seu mapa de leitura',styles['h1']))
    for number, heading in enumerate(headings,1):
        story.append(Paragraph(f'{number:02d} / {inline(heading)}',styles['body']))
    story.append(Spacer(1,15))
    story.append(Paragraph('Leia primeiro os capitulos de arquitetura e HTTP. Depois acompanhe um cadastro no DevTools e no banco. Use os exercicios para transformar leitura em pratica.',styles['body']))
    story.append(PageBreak())
    lines = text.splitlines()
    i = 0
    first_heading = True
    while i<len(lines):
        line=lines[i]
        if line.startswith('# '):
            if not first_heading:
                story.append(Spacer(1,18))
                story.append(CondPageBreak(380))
            first_heading=False
            story.append(Paragraph(inline(line[2:]),styles['h1']))
        elif line.startswith('## '):
            story.append(Paragraph(inline(line[3:]),styles['h2']))
        elif line.startswith('```'):
            block=[]
            i+=1
            while i<len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i+=1
            add_code(story,'\n'.join(block))
        elif line.startswith('@image '):
            image_path=ROOT/line.split(maxsplit=1)[1]
            from PIL import Image as PILImage
            with PILImage.open(image_path) as pic:
                w,h=pic.size
            scale=min(500/w,(230 if image_path.name == 'home-hero.png' else 300)/h)
            story.append(Image(str(image_path),width=w*scale,height=h*scale))
            story.append(Spacer(1,12))
        elif line.startswith('@diagram'):
            story.append(Architecture())
        elif line.startswith('@code '):
            # @code relative/path.cjs start end (1-based inclusive)
            tokens=line.split()
            path=ROOT/tokens[1]
            start=int(tokens[2]) if len(tokens)>2 else 1
            end=int(tokens[3]) if len(tokens)>3 else start+22
            file_lines=path.read_text(encoding='utf-8').splitlines()
            assert 1<=start<=len(file_lines), f'Invalid excerpt: {line}'
            story.append(Paragraph(escape(tokens[1])+f' / linhas {start}-{min(end,len(file_lines))}',styles['label']))
            snippet='\n'.join(f'{n:03d}  {file_lines[n-1]}' for n in range(start,min(end,len(file_lines))+1))
            add_code(story,snippet)
        elif line.startswith('- '):
            story.append(Paragraph('&#8226; '+inline(line[2:]),styles['body']))
        elif line.strip():
            paragraph=[line]
            while i+1<len(lines) and lines[i+1].strip() and not lines[i+1].startswith(('#','- ','```','@code ')):
                i+=1; paragraph.append(lines[i])
            story.append(Paragraph(inline(' '.join(paragraph)),styles['body']))
        i+=1
    out=DOCS/'CyberShield-Guia-Completo.pdf'
    doc=SimpleDocTemplate(str(out),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=56,bottomMargin=48,title='CyberShield: do navegador ao banco de dados',author='CyberShield / guia de estudo',pageCompression=1)
    doc.build(story,canvasmaker=GuideCanvas)
    print(out)

if __name__=='__main__':
    build()
