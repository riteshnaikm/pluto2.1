"""One-off helper: convert a Markdown file to PDF (stdout path on success)."""
import sys
from pathlib import Path

import markdown
from xhtml2pdf import pisa

STYLES = """
@page { margin: 2cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.45; color: #222; }
h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
h2 { font-size: 14pt; margin-top: 1.2em; color: #111; }
h3 { font-size: 12pt; }
table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 9pt; }
th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #eee; font-weight: bold; }
pre { background: #f6f6f6; border: 1px solid #ddd; padding: 8px; font-size: 8pt;
      font-family: Courier, monospace; white-space: pre-wrap; word-wrap: break-word; }
code { font-family: Courier, monospace; font-size: 8.5pt; background: #f0f0f0; padding: 1px 3px; }
hr { border: none; border-top: 1px solid #ccc; margin: 1.5em 0; }
p { margin: 0.5em 0; }
strong { font-weight: bold; }
"""


def convert(md_path: Path, pdf_path: Path | None = None) -> Path:
    pdf_path = pdf_path or md_path.with_suffix(".pdf")
    md_text = md_path.read_text(encoding="utf-8")
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "nl2br"])
    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'/>"
        f"<style>{STYLES}</style></head><body>{body}</body></html>"
    )
    with open(pdf_path, "wb") as pdf_file:
        status = pisa.CreatePDF(html, dest=pdf_file, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"PDF generation failed with {status.err} error(s)")
    return pdf_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/md_to_pdf.py <path/to/file.md>", file=sys.stderr)
        sys.exit(1)
    out = convert(Path(sys.argv[1]))
    print(out)
