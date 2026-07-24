#!/usr/bin/env python3
"""Build the native HTML Teacher's Guide from its canonical DOCX source."""

from html import escape
from pathlib import Path
import re

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Dharma-Program-Teachers-Guide.docx"
OUTPUT = ROOT / "teachers-guide.html"


def blocks(document):
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def slug(text):
    value = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return value or "section"


def rich_text(paragraph):
    chunks = []
    for run in paragraph.runs:
        text = escape(run.text).replace("\n", "<br>")
        if not text:
            continue
        if run.bold:
            text = f"<strong>{text}</strong>"
        if run.italic:
            text = f"<em>{text}</em>"
        chunks.append(text)
    return "".join(chunks) or escape(paragraph.text)


def cell_html(cell):
    parts = [rich_text(p) for p in cell.paragraphs if p.text.strip()]
    return "<br>".join(parts)


def table_html(table):
    rows = [[cell_html(cell) for cell in row.cells] for row in table.rows]
    if len(rows) == 1 and len(rows[0]) == 1:
        lines = rows[0][0].split("<br>", 1)
        label = lines[0]
        body = lines[1] if len(lines) > 1 else ""
        return (
            '<aside class="guide-callout">'
            f'<div class="guide-callout-label">{label}</div>'
            f"<p>{body}</p>"
            "</aside>"
        )

    output = ['<div class="table-scroll"><table>']
    if len(rows) > 1 and len(rows[0]) >= 3:
        output.append("<thead><tr>")
        output.extend(f"<th>{cell}</th>" for cell in rows[0])
        output.append("</tr></thead><tbody>")
        data_rows = rows[1:]
    else:
        output.append('<tbody class="key-table">')
        data_rows = rows

    for row in data_rows:
        output.append("<tr>")
        for index, cell in enumerate(row):
            tag = "th" if len(row) == 2 and index == 0 else "td"
            output.append(f"<{tag}>{cell}</{tag}>")
        output.append("</tr>")
    output.append("</tbody></table></div>")
    return "".join(output)


def build():
    document = Document(SOURCE)
    body = []
    toc = []
    seen_title = False

    for block in blocks(document):
        if isinstance(block, Table):
            body.append(table_html(block))
            continue

        text = block.text.strip()
        if not text:
            continue
        style = block.style.name if block.style else ""

        if not seen_title:
            if text == "The Dharma Program":
                continue
            if text == "A Teacher's Guide":
                seen_title = True
                continue
            continue

        if text == "For teachers who are new to it":
            continue
        if text.startswith("You don't need to be a scholar of Buddhism"):
            continue
        if text == "Dharma Program — Teacher's Guide":
            continue

        if style == "Heading 1":
            anchor = slug(text)
            toc.append((anchor, text))
            body.append(f'<h2 id="{anchor}">{rich_text(block)}</h2>')
        elif style == "Heading 2":
            body.append(f"<h3>{rich_text(block)}</h3>")
        elif re.match(r"^\d+\.\s", text):
            body.append(f'<p class="numbered-point">{rich_text(block)}</p>')
        elif text.startswith('"') and text.endswith('"'):
            body.append(f"<blockquote><p>{rich_text(block)}</p></blockquote>")
        else:
            body.append(f"<p>{rich_text(block)}</p>")

    intro = (
        "You don’t need to be a scholar of Buddhism to teach this curriculum beautifully. "
        "You need curiosity, warmth, and the willingness to learn alongside your students. "
        "This guide will give you everything else."
    )
    toc_links = "".join(f'<a href="#{anchor}">{escape(label)}</a>' for anchor, label in toc)
    nav = (
        '<nav class="nav"><a class="nav-logo" href="index.html">Hidden Land Dharma</a>'
        '<div class="nav-links"><a href="index.html">Overview</a>'
        '<a href="grade-1.html">Grade 1</a><a href="grade-2.html">Grade 2</a>'
        '<a href="grade-3.html">Grade 3</a><a href="grade-4.html">Grade 4</a>'
        '<a href="grade-5.html">Grade 5</a><a href="grade-6.html">Grade 6</a>'
        '<a href="grade-7.html">Grade 7</a><a href="grade-8.html">Grade 8</a>'
        '<a href="teachers-guide.html" aria-current="page">Teacher’s Guide</a>'
        '<a href="origins.html">Origins</a><a href="reference.html">Reference</a></div></nav>'
    )
    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="A practical guide for teachers using the Hidden Land Dharma curriculum.">
  <title>Teacher’s Guide | Hidden Land Dharma</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&family=Lora:ital,wght@0,400;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/curriculum.css">
  <link rel="stylesheet" href="assets/teachers-guide.css">
</head>
<body>
{nav}
<div class="wrap">
  <header class="grade-hero guide-hero">
    <div class="eyebrow">Grades 1–8 · Teacher orientation</div>
    <h1>A Teacher’s<br><em>Guide</em></h1>
    <p class="grade-summary">{intro}</p>
  </header>
  <div class="layout guide-layout">
    <article class="content guide-content">
      {''.join(body)}
    </article>
    <aside class="toc"><strong>In this guide</strong>{toc_links}</aside>
  </div>
  <div class="pager">
    <a href="index.html">← Overview</a>
    <span>Hidden Land Dharma</span>
    <a href="grade-1.html">Begin Grade 1 →</a>
  </div>
</div>
</body>
</html>
"""
    OUTPUT.write_text(page, encoding="utf-8")


if __name__ == "__main__":
    build()
