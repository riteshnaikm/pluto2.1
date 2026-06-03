# PeopleLogic Brand Colour Audit & Implementation

**Palette (only these + white/black neutrals):**

| Role | Hex | Token |
|------|-----|-------|
| Primary (Blue) | `#0d6fae` | `--pl-primary` |
| Accent Warm (Orange) | `#e26014` | `--pl-orange` |
| Accent Olive | `#7d8e2c` | `--pl-olive` |
| Accent Yellow | `#f6c206` | `--pl-yellow` |
| Text / surface | `#1a1a2e`, `#ffffff`, `#f8f9fa`, `#dee2e6`, `#6b7280` | `--pl-text-*`, `--pl-surface`, `--pl-border` |

---

## Step 1 — Files touched

| Layer | Files |
|-------|--------|
| Tokens | `static/css/brand-tokens.css` |
| Bootstrap remap | `static/css/bootstrap-overrides.css` |
| Global | `static/css/style.css`, `templates/base.html` |
| Feature | `static/css/copilot.css`, `dashboard.css`, `hub.css`, `pluto-handbook-result.css`, `pluto-handbook-evolved.css`, `handbook-intake.css` |
| JS | `static/js/dashboard.js`, `static/js/resume-evaluator.js` |
| Templates | `index1.html`, `index2.html`, `history.html`, `base.html` |
| PDF | `app.py` (ReportLab / canvas) |

**Load order (base):** Bootstrap CDN → `brand-tokens.css` → `bootstrap-overrides.css` → page CSS.

**Intentional exception:** Google sign-in SVG in `login.html` keeps official Google brand colours (`#4285F4`, etc.) — not PLUTO UI.

**Legacy / unused:** `base2.html` and `index2.html.backup` were removed in repo cleanup (2026).

---

## Step 2 — Find-and-replace table (non-brand → brand)

### CSS (`static/css/`)

| Old value | Used for | Replace with | File / selector |
|-----------|----------|--------------|-----------------|
| `#3498db`, `#2980b9` | Legacy PLUTO blue | `var(--pl-primary)`, `var(--pl-primary-dark)` | `style.css` (done) |
| `#2c3e50`, `#34495e` | Headings / ink | `var(--pl-text-primary)`, `var(--pl-text-secondary)` | `style.css` (done) |
| `#0f172a`, `#334155`, `#64748b` | Handbook ink scale | `var(--pl-text-primary)`, `var(--pl-text-secondary)` | `pluto-handbook-result.css` |
| `#0b3f63`, `#07304d` | Sidebar gradient | `var(--pl-primary-dark)` + `color-mix(...)` | `pluto-handbook-result.css` `.sidebar` |
| `#0b5f96`, `#0c6099` | Link / button hover | `var(--pl-primary-dark)` | `pluto-handbook-result.css` |
| `#030712`, `#334155` | Evolved handbook text | `var(--pl-text-primary)`, `var(--pl-text-secondary)` | `pluto-handbook-evolved.css` |
| `#0b1220`, `#e2e8f0`, `#1e293b` | Boolean console | `var(--pl-text-primary)`, `var(--pl-white)`, `var(--pl-border)` | `pluto-handbook-evolved.css` `.hb-boolean-console` |
| `#6c757d` | Muted / skeleton | `var(--pl-text-secondary)` | `dashboard.css` |
| `#f0f0f0`, `#e0e0e0` | Light shimmer | `var(--pl-surface)`, `var(--pl-border)` | `dashboard.css` |
| `#2a3544`, `#3a4656` | Dark shimmer | `var(--pl-text-primary)` mix | `dashboard.css` |
| `rgba(52, 152, 219, …)` | Input focus ring | `color-mix(..., var(--pl-primary))` | `style.css` `.form-control:focus` |
| `#23233a` | Dark copilot surface | `var(--pl-surface)` | `copilot.css`, `brand-tokens.css` dark |
| oklch legacy accents | Co-pilot tiles | `--c-blue/green/yellow/orange` → brand hex | `copilot.css` |

### Templates

| Old / class | Usage | Brand mapping | File |
|-------------|-------|---------------|------|
| `#f6c000`, `#ccc` | Star rating JS/CSS | `var(--pl-yellow)`, `var(--pl-border)` | `index1.html` |
| `#000` on `.btn-warning` | Warning button text | `var(--pl-text-primary)` | `base.html` inline |
| `#000` | History modal emphasis | `var(--pl-text-primary)` | `history.html` |
| `btn-success` on Download PDF | Success CTA | Bootstrap override → olive | `index2.html` — keep class; CSS maps to olive |
| `text-muted`, `bg-light` | Bootstrap utilities | Remapped via tokens + `--pl-text-secondary` / `--pl-surface` | All templates — **no class rename required** |
| Inline gradient `rgba(13,111,174…)` | Recruiter narrative | `color-mix(var(--pl-primary), var(--pl-yellow))` | `index2.html` `#recruiter-narrative` |

### JavaScript

| Old | Usage | Replace | File |
|-----|-------|---------|------|
| `rgb(13, 110, 253)` etc. | Chart.js lines/bars | `PLUTO_BRAND_CHART.*` | `dashboard.js` |
| Bootstrap doughnut palette (red/cyan/purple…) | Score / user charts | Orange → yellow → olive sequence; 4-colour user slice | `dashboard.js` |
| `#6c757d` | N/A progress bar | `var(--pl-text-secondary)` | `resume-evaluator.js` |
| Badge thresholds 75/50 | Batch results | **70 / 40** + `success`/`warning`/`danger` classes | `resume-evaluator.js` |
| (none hardcoded elsewhere) | Match dial tiers | `applyMatchScoreTier()` + `data-match-tier` | `resume-evaluator.js` |

### `app.py` (PDF)

| Old | Replace |
|-----|---------|
| `#0068AB` | `#0d6fae` |
| `#2c3e50` | `#1a1a2e` |
| `#34495e` | `#6b7280` |
| `#0d6efd` | `#0d6fae` |
| `#22c55e` / `#16a34a` | `#7d8e2c` / `#647220` |
| `#f59e0b` / `#d97706` | `#f6c206` / `#d4a605` |
| `#2563eb` / `#1d4ed8` | `#0d6fae` / `#0a5a8e` |
| `#fbbf24`, `#93c5fd` | `#f6c206`, `#e8f4fc` |

---

## Step 3 — Semantic rules (enforced)

| UI meaning | Threshold / rule | Colour |
|------------|------------------|--------|
| Strong match | ≥ 70% (≥ 85% = Exceptional, same olive) | Olive `#7d8e2c` |
| Moderate match | 40–69% | Yellow `#f6c206` |
| Weak match | &lt; 40% | Orange `#e26014` |
| Primary CTAs | Evaluate, Generate, Submit | Blue `#0d6fae` |
| Star ratings | Selected stars | Yellow |
| AI thinking shimmer | Loading | Yellow @ 30% opacity (`.pl-shimmer` in overrides) |
| Success toast/alert | `.alert-success` | Olive tint |
| Error toast/alert | `.alert-danger` | Orange tint |
| Info callout | `.alert-info` | Blue tint `#e8f4fc` |

**JS:** `getMatchScoreTier()`, `applyMatchScoreTier()`, `PLUTO_BRAND_HEX` in `resume-evaluator.js`.  
**CSS:** `.progress-bar.match-tier-*`, `.score-dial[data-match-tier]` in `bootstrap-overrides.css`.

---

## Step 4 — Chart.js palette (`dashboard.js`)

```javascript
const PLUTO_BRAND_CHART = {
  primary: 'rgba(13, 111, 174, 0.85)',
  olive: 'rgba(125, 142, 44, 0.85)',
  yellow: 'rgba(246, 194, 6, 0.85)',
  orange: 'rgba(226, 96, 20, 0.85)',
  scoreBuckets: [orange, orange, yellow, yellow, olive],  // low → high
  userSlice: [primary, olive, yellow, orange],             // cycles for top users
};
```

Activity / team line charts: primary (evaluations) + olive (handbooks).  
Doughnuts: bucket colours only from the four brand RGBA values.

---

## Step 5 — Verification checklist

1. Hard refresh (Ctrl+F5) on `/resume-evaluator`, `/dashboard`, handbook result.
2. Match score ring + progress bar: greenish at 80%, yellow at 50%, orange at 30%.
3. Dashboard charts: no purple/cyan/red Bootstrap slices.
4. Toggle dark mode: surfaces `#1a1a2e`, borders `#2d3748`, brand accents unchanged.
5. Export evaluation PDF: headings blue `#0d6fae`, match glyphs olive/yellow/blue per tier logic in `app.py`.

---

## Remaining optional cleanup

- Consolidate duplicate `:root` in `pluto-handbook-result.css` (OD export artifact) when that file is next regenerated from Open Design.
- Stale template backups removed during docs reorganisation.
- Audit inline `style=` attributes in long handbook HTML strings inside JS if any hex sneaks in at runtime.

*Last updated: brand enforcement pass — May 2026.*
