from pathlib import Path

p = Path(__file__).resolve().parents[1] / "templates" / "index2.html"
lines = p.read_text(encoding="utf-8").splitlines()
link = "<link rel=\"stylesheet\" href=\"{{ url_for('static', filename='css/copilot.css') }}\">"
new_lines = lines[:11] + [link] + lines[992:]
p.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
print(f"Wrote {len(new_lines)} lines")
