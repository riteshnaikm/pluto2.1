// Resume Evaluator with Recruiter Handbook Support

/** Shared fetch with CSRF — must be file-scoped for blur/URL auto-fill helpers below. */
function apiFetch(url, options) {
    if (typeof plutoFetch === 'function') {
        return plutoFetch(url, options);
    }
    options = options || {};
    const method = (options.method || 'GET').toUpperCase();
    const headers = Object.assign({}, options.headers || {});
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const token = typeof getCsrfToken === 'function' ? getCsrfToken() : '';
        if (token) headers['X-CSRFToken'] = token;
    }
    let body = options.body;
    if (
        body &&
        typeof body === 'object' &&
        !(body instanceof FormData) &&
        !(body instanceof Blob)
    ) {
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
    }
    return fetch(url, Object.assign({}, options, { method, headers, body }));
}
window.apiFetch = apiFetch;

const PLUTO_BRAND_HEX = {
    primary: '#0d6fae',
    olive: '#7d8e2c',
    yellow: '#f6c206',
    orange: '#e26014',
};

function getMatchScoreTier(score) {
    const s = Number(score) || 0;
    if (s >= 85) return 'exceptional';
    if (s >= 70) return 'strong';
    if (s >= 40) return 'moderate';
    return 'weak';
}

function matchTierAccent(tier) {
    if (tier === 'strong' || tier === 'exceptional') return PLUTO_BRAND_HEX.olive;
    if (tier === 'moderate') return PLUTO_BRAND_HEX.yellow;
    return PLUTO_BRAND_HEX.orange;
}

function applyMatchScoreTier(score) {
    const tier = getMatchScoreTier(score);
    const accent = matchTierAccent(tier);
    const barTier = tier === 'exceptional' ? 'strong' : tier;
    const ring = document.getElementById('match-score-ring');
    const bar = document.getElementById('progress-bar');
    const verdict = document.getElementById('match-score-verdict');
    if (ring) {
        ring.dataset.matchTier = tier;
        ring.style.setProperty('--score-accent', accent);
    }
    if (bar) {
        bar.classList.remove('match-tier-strong', 'match-tier-moderate', 'match-tier-weak');
        bar.classList.add('match-tier-' + barTier);
    }
    if (verdict) {
        verdict.style.color = accent;
    }
}
window.applyMatchScoreTier = applyMatchScoreTier;

const BATCH_SCORE_STRONG = 70;
const BATCH_SCORE_MODERATE = 40;

function batchDisplayFilename(storedName) {
    if (!storedName) return 'Candidate';
    const name = String(storedName).trim();
    const m = name.match(/^[a-f0-9]{32}_(.+)$/i);
    return m ? m[1] : name;
}

/** Readable candidate name from stored upload filename (mirrors pluto.uploads.candidate_display_name). */
function batchCandidateDisplayName(storedName) {
    if (!storedName) return 'Candidate';
    let base = batchDisplayFilename(storedName).replace(/\.[^/.]+$/, '').trim();
    if (!base) return 'Candidate';
    const words = [];
    base.split(/[_\-\s]+/).forEach(function (segment) {
        segment = segment.trim();
        if (!segment || /^\d+$/.test(segment)) return;
        const spaced = segment.replace(/([a-z])([A-Z])/g, '$1 $2');
        spaced.split(/\s+/).forEach(function (token) {
            token = token.replace(/\./g, '').trim();
            if (token.length < 2) return;
            if (/^[a-f0-9]{6,}$/i.test(token)) return;
            words.push(token.charAt(0).toUpperCase() + token.slice(1).toLowerCase());
        });
    });
    if (!words.length) return 'Candidate';
    return words.length > 3 ? words.slice(0, 3).join(' ') : words.join(' ');
}

function batchCandidateLabel(result) {
    if (!result) return 'Candidate';
    return (result.candidate_name || batchCandidateDisplayName(result.filename || '')).trim() || 'Candidate';
}

function enhanceBatchReportMarkdown(container, results) {
    if (!container) return;
    container.classList.add('batch-report-enhanced');
    results = results || [];
    container.querySelectorAll('h3').forEach(function (h3) {
        const t = (h3.textContent || '').toLowerCase();
        if (t.indexOf('candidate summary') === -1) return;
        let el = h3.nextElementSibling;
        while (el && el.tagName !== 'TABLE') {
            if (el.tagName === 'H2' || el.tagName === 'H1') break;
            el = el.nextElementSibling;
        }
        if (el && el.tagName === 'TABLE') {
            el.classList.add('batch-summary-table');
        }
    });
    // Legacy reports: packed **Name:** lines → hide when a summary table exists nearby
    container.querySelectorAll('p').forEach(function (p) {
        const text = p.textContent || '';
        if (/^\*\*Name:\*\*/i.test(p.innerHTML) || /^Name:/i.test(text.trim())) {
            const parent = p.parentElement;
            if (parent && parent.querySelector('table.batch-summary-table')) {
                p.classList.add('batch-legacy-packed-summary');
            }
        }
    });
    function patchSummaryTable(table, result) {
        if (!table || !result) return;
        table.querySelectorAll('tr').forEach(function (tr) {
            if (!tr.cells || tr.cells.length < 2) return;
            const label = (tr.cells[0].textContent || '').toLowerCase();
            if (label.indexOf('candidate') !== -1) {
                tr.cells[1].textContent = batchCandidateLabel(result);
            } else if (label.indexOf('resume') !== -1) {
                tr.cells[1].textContent = result.display_filename || batchDisplayFilename(result.filename);
            }
        });
    }

    const candidateHeadings = container.querySelectorAll('h2');
    candidateHeadings.forEach(function (h2, idx) {
        h2.classList.add('batch-report-candidate-heading');
        if (results[idx]) {
            h2.textContent = batchCandidateLabel(results[idx]);
            let el = h2.nextElementSibling;
            while (el) {
                if (el.tagName === 'TABLE') {
                    el.classList.add('batch-summary-table');
                    patchSummaryTable(el, results[idx]);
                    break;
                }
                if (el.tagName === 'H2') break;
                el = el.nextElementSibling;
            }
        }
    });
    const multiHeading = Array.from(container.querySelectorAll('h1, h2')).find(function (h) {
        return (h.textContent || '').toLowerCase().indexOf('multi-candidate') !== -1;
    });
    if (multiHeading) {
        let el = multiHeading.nextElementSibling;
        while (el) {
            if (el.tagName === 'TABLE') {
                el.classList.add('batch-comparison-report-table');
                if (results.length) {
                    const ths = el.querySelectorAll('thead th');
                    for (let i = 0; i < results.length && i + 1 < ths.length; i++) {
                        ths[i + 1].textContent = batchCandidateLabel(results[i]);
                    }
                }
                break;
            }
            el = el.nextElementSibling;
        }
    }
}

function batchScoreTier(pct) {
    const s = Number(pct) || 0;
    if (s >= BATCH_SCORE_STRONG) return 'strong';
    if (s >= BATCH_SCORE_MODERATE) return 'moderate';
    return 'weak';
}

function batchVerdictLabel(pct) {
    const s = Number(pct) || 0;
    if (s >= 85) return 'Exceptional match';
    if (s >= BATCH_SCORE_STRONG) return 'Strong match';
    if (s >= BATCH_SCORE_MODERATE) return 'Moderate match';
    return 'Weak match';
}

function batchInitials(labelOrResult) {
    const label = typeof labelOrResult === 'object'
        ? batchCandidateLabel(labelOrResult)
        : batchCandidateDisplayName(labelOrResult);
    const clean = label.replace(/\.[^/.]+$/, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (clean.slice(0, 2) || 'CV').toUpperCase();
}

function batchEscapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : text;
    return div.innerHTML;
}

function showBatchComparisonUI() {
    const inputWrap = document.getElementById('matchmaker-input-wrap');
    const batchWrap = document.getElementById('batch-results');
    const singleResult = document.getElementById('evaluation-result');
    const statusPanel = document.getElementById('matchmaker-status');
    if (inputWrap) inputWrap.style.display = 'none';
    if (singleResult) singleResult.style.display = 'none';
    if (statusPanel) statusPanel.style.display = 'none';
    if (batchWrap) {
        batchWrap.style.display = 'block';
        setTimeout(function () {
            batchWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    }
    if (typeof window.setCopilotHeroVisible === 'function') {
        window.setCopilotHeroVisible(false);
    }
}

function resetBatchComparisonUI() {
    const inputWrap = document.getElementById('matchmaker-input-wrap');
    const batchWrap = document.getElementById('batch-results');
    const singleResult = document.getElementById('evaluation-result');
    if (inputWrap) inputWrap.style.display = '';
    if (batchWrap) batchWrap.style.display = 'none';
    if (singleResult) singleResult.style.display = 'none';
    if (typeof window.setCopilotHeroVisible === 'function') {
        window.setCopilotHeroVisible(true);
    }
}

function renderBatchComparison(data, opts) {
    opts = opts || {};
    const results = (data.results || []).slice().sort(function (a, b) {
        return (b.match_percentage || 0) - (a.match_percentage || 0);
    });
    const jobTitle = (opts.jobTitle || '').trim();
    const metaEl = document.getElementById('batch-comparison-meta');
    const boardEl = document.getElementById('batch-leaderboard');
    const matrixEl = document.getElementById('batch-matrix-wrap');
    const detailsEl = document.getElementById('batch-candidate-details');
    const reportEl = document.getElementById('batch-report-markdown');

    if (metaEl) {
        const n = results.length;
        let meta = n + ' candidate' + (n !== 1 ? 's' : '') + ' ranked by match score' +
            (jobTitle ? ' for “' + jobTitle + '”' : '') + '.';
        const saved = data.saved_count != null ? data.saved_count : results.filter(function (r) {
            return r.evaluation_id;
        }).length;
        if (saved > 0) {
            meta += ' Each saved separately in Job History';
            meta += ' (<i class="bi bi-people-fill eval-mode-icon eval-mode-batch" aria-hidden="true"></i> batch comparison).';
        }
        metaEl.innerHTML = meta;
    }

    if (boardEl) {
        boardEl.innerHTML = results.map(function (r, idx) {
            const tier = batchScoreTier(r.match_percentage);
            const label = batchCandidateLabel(r);
            const strengths = (r.top_strengths || []).slice(0, 4);
            const gaps = (r.key_gaps || []).slice(0, 3);
            const rankClass = idx === 0 ? ' rank-1' : '';
            return (
                '<article class="batch-candidate-card tier-' + tier + rankClass + '" role="listitem">' +
                '<div class="batch-candidate-card-header">' +
                '<span class="batch-rank-badge" aria-label="Rank ' + (idx + 1) + '">#' + (idx + 1) + '</span>' +
                '<div class="batch-candidate-avatar" aria-hidden="true">' + batchEscapeHtml(batchInitials(r)) + '</div>' +
                '<div class="batch-candidate-info">' +
                '<p class="batch-candidate-name">' + batchEscapeHtml(label) + '</p>' +
                '<div class="batch-match-pill tier-' + tier + '">' + (r.match_percentage || 0) + '%</div>' +
                '<div class="batch-verdict-label">' + batchEscapeHtml(batchVerdictLabel(r.match_percentage)) + '</div>' +
                '</div></div>' +
                (strengths.length ? '<p class="batch-section-label">Top strengths</p><div class="batch-chip-row">' +
                    strengths.map(function (s) {
                        return '<span class="batch-chip chip-strength">' + batchEscapeHtml(s) + '</span>';
                    }).join('') + '</div>' : '') +
                (gaps.length ? '<p class="batch-section-label">Key gaps</p><div class="batch-chip-row">' +
                    gaps.map(function (g) {
                        return '<span class="batch-chip chip-gap">' + batchEscapeHtml(g) + '</span>';
                    }).join('') + '</div>' : '') +
                (r.evaluation_id
                    ? '<div class="batch-card-actions mt-1">' +
                      '<a href="/resume-evaluator?view_evaluation=' + r.evaluation_id + '" class="btn btn-sm btn-outline-primary">' +
                      '<i class="bi bi-eye"></i> View saved evaluation</a>' +
                      '<a href="/history" class="btn btn-sm btn-link">Job History</a></div>'
                    : '') +
                '</article>'
            );
        }).join('');
    }

    if (matrixEl && results.length) {
        const headCells = results.map(function (r) {
            return '<th scope="col">' + batchEscapeHtml(batchCandidateLabel(r)) + '</th>';
        }).join('');
        function matrixRow(label, valueFn) {
            const cells = results.map(function (r) {
                const tier = batchScoreTier(r.match_percentage);
                return '<td class="cell-score tier-' + tier + '">' + batchEscapeHtml(String(valueFn(r))) + '</td>';
            }).join('');
            return '<tr><th scope="row">' + batchEscapeHtml(label) + '</th>' + cells + '</tr>';
        }
        matrixEl.innerHTML =
            '<h3 class="h6 mb-2"><i class="bi bi-table me-2" style="color:var(--pl-primary)"></i>Quick comparison</h3>' +
            '<div class="table-responsive"><table class="batch-matrix-table">' +
            '<thead><tr><th scope="col">Metric</th>' + headCells + '</tr></thead><tbody>' +
            matrixRow('Match score', function (r) { return (r.match_percentage || 0) + '%'; }) +
            matrixRow('Verdict', function (r) { return batchVerdictLabel(r.match_percentage); }) +
            matrixRow('Top strength', function (r) {
                return (r.top_strengths && r.top_strengths[0]) || '—';
            }) +
            matrixRow('Primary gap', function (r) {
                return (r.key_gaps && r.key_gaps[0]) || '—';
            }) +
            '</tbody></table></div>';
    }

    if (detailsEl) {
        detailsEl.innerHTML = results.map(function (r, idx) {
            const tier = batchScoreTier(r.match_percentage);
            const label = batchCandidateLabel(r);
            const strengths = r.top_strengths || [];
            const gaps = r.key_gaps || [];
            const openAttr = idx === 0 ? ' open' : '';
            return (
                '<details class="batch-detail-panel tier-' + tier + '"' + openAttr + '>' +
                '<summary><span><i class="bi bi-people-fill eval-mode-icon eval-mode-batch me-1" aria-hidden="true"></i>' +
                batchEscapeHtml(label) + ' — ' + (r.match_percentage || 0) + '%</span>' +
                '<span class="badge eval-mode-badge-batch me-1">Batch</span>' +
                '<span class="badge bg-' + (tier === 'strong' ? 'success' : tier === 'moderate' ? 'warning' : 'danger') + '">' +
                batchEscapeHtml(batchVerdictLabel(r.match_percentage)) + '</span></summary>' +
                '<div class="batch-detail-body"><div class="batch-detail-grid">' +
                '<div><p class="batch-section-label mb-1">Strengths</p><ul class="batch-detail-list">' +
                (strengths.length ? strengths.map(function (s) {
                    return '<li>' + batchEscapeHtml(s) + '</li>';
                }).join('') : '<li class="text-muted">None highlighted</li>') +
                '</ul></div>' +
                '<div><p class="batch-section-label mb-1">Gaps / risks</p><ul class="batch-detail-list">' +
                (gaps.length ? gaps.map(function (g) {
                    return '<li>' + batchEscapeHtml(g) + '</li>';
                }).join('') : '<li class="text-muted">No critical gaps surfaced</li>') +
                '</ul></div></div></div></details>'
            );
        }).join('');
    }

    if (reportEl) {
        const details = reportEl.closest('details');
        if (data.report_markdown && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            reportEl.innerHTML = DOMPurify.sanitize(marked.parse(data.report_markdown));
            enhanceBatchReportMarkdown(reportEl, results);
            if (details) details.open = false;
        } else {
            reportEl.innerHTML = '';
            if (details) details.style.display = 'none';
        }
    }

    showBatchComparisonUI();
}
window.renderBatchComparison = renderBatchComparison;

/** Wire Oorwin Job ID field → history lookup (blur, change, debounced input). */
function bindOorwinJobIdAutofill(inputEl, fillFn) {
    if (!inputEl || typeof fillFn !== 'function') return;
    let debounceTimer = null;
    const run = function () {
        const jobId = inputEl.value.trim();
        if (jobId) fillFn(jobId);
    };
    inputEl.addEventListener('blur', run);
    inputEl.addEventListener('change', run);
    inputEl.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(run, 500);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    function setHandbookResultHeader(jobTitle) {
        const fromForm = (document.getElementById('handbook_job_title')?.value || '').trim();
        const actualTitle = (jobTitle || fromForm || 'Recruiter Handbook').trim();
        const display = 'Job Title : ' + actualTitle;
        const pageTitleEl = document.getElementById('handbook-result-page-title');
        if (pageTitleEl) {
            pageTitleEl.textContent = display;
        }
    }
    window.setHandbookResultHeader = setHandbookResultHeader;

    function finalizeHandbookResultPresentation(jobTitle) {
        enhanceHandbookFormatting();
        if (window.applyHandbookResultWorkspace) {
            window.applyHandbookResultWorkspace({ jobTitle: jobTitle || '' });
        } else if (window.refreshHandbookCopyButtons) {
            window.refreshHandbookCopyButtons();
        }
    }

    window.activateCopilotSection = function (section) {
        const handbookSection = document.getElementById('handbook-section');
        const matchmakerSection = document.getElementById('matchmaker-section');
        if (handbookSection && matchmakerSection) {
            if (section === 'handbook') {
                handbookSection.style.display = '';
                matchmakerSection.style.display = 'none';
            } else if (section === 'matchmaker') {
                handbookSection.style.display = 'none';
                matchmakerSection.style.display = '';
            }
        }
        if (section === 'handbook' && typeof window.syncCopilotHeroForHandbook === 'function') {
            window.syncCopilotHeroForHandbook();
        } else if (typeof window.setCopilotHeroVisible === 'function') {
            window.setCopilotHeroVisible(true);
        }
        document.querySelectorAll('[data-copilot-module]').forEach(function (el) {
            const m = el.getAttribute('data-copilot-module');
            if (m) el.classList.toggle('active', m === section);
        });
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('section', section);
            window.history.replaceState({}, '', u);
        } catch (e) { /* noop */ }

        var bubbleFn = window.updateCopilotBubble;
        if (typeof bubbleFn === 'function') bubbleFn(section);

        var insightsFn = window.updateCopilotInsights;
        if (typeof insightsFn === 'function') insightsFn(section);
    };

    const evaluationForm = document.getElementById('evaluationForm');
    const feedbackForm = document.getElementById('feedbackForm');
    const resultDiv = document.getElementById('evaluation-result');
    const submitBtn = document.getElementById('submitBtn');

    const batchNewBtn = document.getElementById('batch-new-comparison');
    if (batchNewBtn) {
        batchNewBtn.addEventListener('click', function () {
            resetBatchComparisonUI();
            if (evaluationForm) evaluationForm.reset();
            const selectedEl = document.getElementById('matchmaker-file-selected');
            if (selectedEl) selectedEl.textContent = '';
            const reportDetails = document.querySelector('.batch-report-details');
            if (reportDetails) reportDetails.style.display = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    (function bindMatchmakerFileZone() {
        const resumeInput = document.getElementById('resume');
        const selectedEl = document.getElementById('matchmaker-file-selected');
        const zone = document.getElementById('matchmaker-file-zone');
        if (!resumeInput) return;
        function updateSelectedLabel() {
            if (!selectedEl) return;
            const files = resumeInput.files;
            if (!files || !files.length) {
                selectedEl.textContent = '';
                return;
            }
            const names = Array.from(files).map(function (f) { return f.name; });
            selectedEl.textContent = names.length === 1
                ? 'Selected: ' + names[0]
                : names.length + ' files: ' + names.join(', ');
        }
        resumeInput.addEventListener('change', updateSelectedLabel);
        if (zone) {
            zone.addEventListener('dragenter', function () { zone.classList.add('is-dragover'); });
            zone.addEventListener('dragleave', function () { zone.classList.remove('is-dragover'); });
            zone.addEventListener('drop', function () { zone.classList.remove('is-dragover'); updateSelectedLabel(); });
        }
    })();
    const matchStatusPanel = document.getElementById('matchmaker-status');
    const matchStatusSub = document.getElementById('matchmaker-status-sub');
    const matchStatusBar = document.getElementById('matchmaker-status-bar');
    const matchStatusSteps = document.getElementById('matchmaker-status-steps');

    const stepOrder = ['processing', 'step1', 'step2', 'step3', 'step4', 'complete'];

    const EVAL_SECTION_LABELS = {
        'match-score': 'Calculating match score…',
        'score-breakdown': 'Analyzing match dimensions…',
        'profile-summary': 'Building profile summary…',
        'fit-analysis': 'Running recruiter fit analysis…',
        stability: 'Analyzing stability & career signals…',
        questions: 'Generating interview questions…',
        feedback: 'Finalizing evaluation…',
    };

    function expandAllEvalSections() {
        if (!resultDiv) return;
        resultDiv.querySelectorAll('.copilot-results-details').forEach((el) => {
            el.open = true;
        });
        const breakdown = document.getElementById('candidateScoreBreakdown');
        if (breakdown && !breakdown.classList.contains('show')) {
            breakdown.classList.add('show');
        }
        const breakdownToggle = document.querySelector(
            '[data-bs-target="#candidateScoreBreakdown"]'
        );
        if (breakdownToggle) {
            breakdownToggle.setAttribute('aria-expanded', 'true');
            breakdownToggle.classList.remove('collapsed');
        }
    }

    function beginEvaluationResultsLayout() {
        if (!resultDiv) return;
        resultDiv.style.display = 'block';
        expandAllEvalSections();
        resultDiv.querySelectorAll('.eval-section').forEach((el) => {
            const key = el.getAttribute('data-eval-section');
            el.classList.add('is-loading');
            el.classList.remove('is-ready');
            const label = el.querySelector('.eval-section-label');
            if (label && key && EVAL_SECTION_LABELS[key]) {
                label.textContent = EVAL_SECTION_LABELS[key];
            }
            const overlay = el.querySelector('.eval-section-overlay');
            if (overlay) overlay.setAttribute('aria-hidden', 'false');
        });
        setTimeout(() => {
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    }

    function markEvalSectionReady(sectionKey) {
        if (!resultDiv) return;
        resultDiv
            .querySelectorAll(`.eval-section[data-eval-section="${sectionKey}"]`)
            .forEach((el) => {
                el.classList.remove('is-loading');
                el.classList.add('is-ready');
                const overlay = el.querySelector('.eval-section-overlay');
                if (overlay) overlay.setAttribute('aria-hidden', 'true');
            });
    }

    function markAllEvalSectionsReady() {
        if (!resultDiv) return;
        resultDiv.querySelectorAll('.eval-section').forEach((el) => {
            el.classList.remove('is-loading');
            el.classList.add('is-ready');
            const overlay = el.querySelector('.eval-section-overlay');
            if (overlay) overlay.setAttribute('aria-hidden', 'true');
        });
    }

    function showMatchStatus(initialText = 'Starting analysis...') {
        if (!matchStatusPanel) return;
        matchStatusPanel.style.display = 'block';
        if (matchStatusSub) matchStatusSub.textContent = initialText;
        if (matchStatusBar) matchStatusBar.style.width = '6%';
        if (matchStatusSteps) {
            matchStatusSteps.querySelectorAll('li').forEach(li => li.classList.remove('active', 'done'));
        }
    }
    function updateMatchStatus(status, message) {
        if (!matchStatusPanel) return;
        const idx = stepOrder.indexOf(status);
        if (matchStatusSub && message) matchStatusSub.textContent = message;
        if (matchStatusBar && idx >= 0) {
            const pct = Math.round(((idx + 1) / stepOrder.length) * 100);
            matchStatusBar.style.width = `${pct}%`;
        }
        if (matchStatusSteps && idx >= 0) {
            matchStatusSteps.querySelectorAll('li').forEach(li => {
                const liStep = li.getAttribute('data-step');
                const liIdx = stepOrder.indexOf(liStep);
                li.classList.toggle('active', liIdx === idx);
                li.classList.toggle('done', liIdx > -1 && liIdx < idx);
            });
        }
    }
    function hideMatchStatus() {
        if (matchStatusPanel) matchStatusPanel.style.display = 'none';
    }
    let currentRating = 0;
    let currentHandbookContent = ''; // Store current handbook content for PDF generation
    let currentHandbookSummary = ''; // AI summary cache for current handbook
    let currentHandbookData = null; // Store handbook form data for auto-filling Match Maker
    let currentEvaluationData = null; // Store current evaluation data for PDF generation
    
    // Load JobID suggestions on page load
    loadJobIdSuggestions();
    
    // Check if we're viewing a stored evaluation or handbook
    checkForViewMode();
    
    // Note: Auto-fill is now handled by sidebar script in index2.html after tab switching

    // Star rating functionality
    const starRating = document.getElementById('star-rating');
    const stars = starRating.querySelectorAll('.star');
    const ratingInput = document.getElementById('rating');

    stars.forEach(star => {
        star.addEventListener('mouseover', function() {
            const value = parseInt(this.dataset.value);
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= value) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
        });
    });

    starRating.addEventListener('mouseout', function() {
        stars.forEach(star => {
            if (parseInt(star.dataset.value) <= currentRating) {
                star.classList.add('selected');
            } else {
                star.classList.remove('selected');
            }
        });
    });

    stars.forEach(star => {
        star.addEventListener('click', function() {
            currentRating = parseInt(this.dataset.value);
            ratingInput.value = currentRating;
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= currentRating) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
        });
    });

    // Evaluation form submission with streaming support
    evaluationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Evaluating...';

        const formData = new FormData(evaluationForm);
        const resumeInput = document.getElementById('resume');
        const files = resumeInput?.files || [];
        const isBatchUpload = files.length > 1;
        if (!isBatchUpload) {
            beginEvaluationResultsLayout();
        } else {
            const batchWrap = document.getElementById('batch-results');
            if (batchWrap) batchWrap.style.display = 'none';
            if (resultDiv) resultDiv.style.display = 'none';
        }
        showMatchStatus(isBatchUpload ? 'Evaluating ' + files.length + ' resumes…' : 'Submitting files and preparing analysis...');
        updateMatchStatus('processing', isBatchUpload ? 'Running batch comparison…' : 'Analyzing resume...');
        const evaluationController = new AbortController();
        const EVAL_INACTIVITY_MS = 180000; // 3 min with no stream events
        const EVAL_MAX_MS = 480000; // 8 min absolute ceiling
        let hasRenderedCoreResults = false;
        let inactivityTimer = null;
        const resetInactivityTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                evaluationController.abort('inactivity-timeout');
            }, EVAL_INACTIVITY_MS);
        };
        resetInactivityTimer();
        const maxTimer = setTimeout(() => {
            evaluationController.abort('max-timeout');
        }, EVAL_MAX_MS);
        
        // Debug: Log oorwin_job_id value
        const oorwinJobId = formData.get('oorwin_job_id') || document.getElementById('oorwin_job_id')?.value || '';
        console.log('Form submission - oorwin_job_id:', oorwinJobId);
        if (!oorwinJobId && formData.get('oorwin_job_id') === null) {
            // Ensure oorwin_job_id is included even if empty
            formData.append('oorwin_job_id', '');
        }

        try {
            async function getResponseErrorMessage(response) {
                // Prefer JSON error message from backend: { error: "..." }
                try {
                    const ct = response.headers.get('content-type') || '';
                    if (ct.includes('application/json')) {
                        const data = await response.json();
                        return data.error || data.message || JSON.stringify(data);
                    }
                } catch (_) {}
                try {
                    const txt = await response.text();
                    if (txt) return txt;
                } catch (_) {}
                return `Request failed (${response.status})`;
            }

            // If multiple files, use batch endpoint
            if (files.length && files.length > 1) {
                const batchForm = new FormData();
                for (const f of files) batchForm.append('resumes', f);
                batchForm.append('job_title', formData.get('job_title'));
                batchForm.append('job_description', formData.get('job_description'));
                batchForm.append('oorwin_job_id', formData.get('oorwin_job_id'));
                batchForm.append('additional_context', formData.get('additional_context') || '');

                const res = await apiFetch('/evaluate-batch', {
                    method: 'POST',
                    body: batchForm,
                    signal: evaluationController.signal
                });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Batch evaluation failed');
                updateMatchStatus('complete', 'Batch evaluation complete.');
                renderBatchComparison(data, {
                    jobTitle: formData.get('job_title') || document.getElementById('job_title')?.value || '',
                });
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Evaluate resume <i class="bi bi-person-check" aria-hidden="true"></i>';
                return;
            }

            const response = await apiFetch('/evaluate-stream', {
                method: 'POST',
                body: formData,
                signal: evaluationController.signal
            });

            if (!response.ok) {
                const msg = await getResponseErrorMessage(response);
                throw new Error(msg);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let dataStore = {}; // Store all data from streaming

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        let eventData;
                        try {
                            eventData = JSON.parse(line.slice(6));
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError);
                            continue;
                        }

                        // Any valid event means stream is alive
                        resetInactivityTimer();

                        // Show backend progress stages in button text for visibility
                        if (eventData.status === 'processing' || /^step\d+$/i.test(eventData.status || '')) {
                            const stageMsg = eventData.message || 'Processing...';
                            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${stageMsg}`;
                            updateMatchStatus(eventData.status, stageMsg);
                            if (eventData.status === 'step2') {
                                const stabilityLabel = resultDiv?.querySelector(
                                    '.eval-section[data-eval-section="stability"] .eval-section-label'
                                );
                                if (stabilityLabel) stabilityLabel.textContent = stageMsg;
                            } else if (eventData.status === 'step3') {
                                const questionsLabel = resultDiv?.querySelector(
                                    '.eval-section[data-eval-section="questions"] .eval-section-label'
                                );
                                if (questionsLabel) questionsLabel.textContent = stageMsg;
                            }
                            continue;
                        }

                        if (eventData.status === 'match_preview') {
                            dataStore.match_percentage = eventData.match_percentage;
                            dataStore.match_percentage_str = eventData.match_percentage_str;
                            displayMatchPreview(dataStore);
                            markEvalSectionReady('match-score');
                            updateMatchStatus('step1', 'Match score ready — finishing analysis…');

                        } else if (eventData.status === 'eval_field_preview') {
                            const profileEl = document.getElementById('profile-summary');
                            if (window.PlutoEvalStream && window.PlutoEvalStream.handleEvalStreamEvent) {
                                window.PlutoEvalStream.handleEvalStreamEvent(eventData, {
                                    profileSummaryEl: profileEl,
                                    markEvalSectionReady: markEvalSectionReady,
                                });
                            } else if (eventData.field === 'profile_summary' && eventData.snippet && profileEl) {
                                if (!profileEl.textContent.trim()) {
                                    profileEl.textContent = eventData.snippet;
                                }
                                markEvalSectionReady('profile-summary');
                            }

                        } else if (eventData.status === 'basic_results') {
                            // Store and display basic results
                            dataStore = { ...dataStore, ...eventData };
                            displayBasicResults(dataStore);
                            markEvalSectionReady('match-score');
                            markEvalSectionReady('score-breakdown');
                            markEvalSectionReady('profile-summary');
                            markEvalSectionReady('fit-analysis');
                            hasRenderedCoreResults = true;

                        } else if (eventData.status === 'additional_data') {
                            // Store and display job stability and career progression
                            dataStore.job_stability = eventData.job_stability;
                            dataStore.career_progression = eventData.career_progression;
                            displayAdditionalData(dataStore);
                            markEvalSectionReady('stability');

                        } else if (eventData.status === 'questions') {
                            // Store and display interview questions
                            dataStore.technical_questions = eventData.technical_questions;
                            dataStore.nontechnical_questions = eventData.nontechnical_questions;
                            dataStore.behavioral_questions = eventData.behavioral_questions;
                            displayQuestions(dataStore);
                            markEvalSectionReady('questions');

                        } else if (eventData.status === 'complete') {
                            console.log('Evaluation complete!');
                            markEvalSectionReady('feedback');
                            updateMatchStatus('complete', eventData.message || 'Analysis complete.');
                            // Update evaluation ID with database ID for feedback submission
                            if (eventData.db_id) {
                                document.getElementById('evaluation-id').value = eventData.db_id;
                                console.log('Updated evaluation ID to database ID:', eventData.db_id);
                            }

                        } else if (eventData.status === 'error') {
                            throw new Error(eventData.message || 'Evaluation failed');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
            if (matchStatusSub) matchStatusSub.textContent = 'Evaluation stopped: ' + (error.message || 'Unknown error');
            if (error.name === 'AbortError') {
                const abortReason = evaluationController.signal && evaluationController.signal.reason
                    ? String(evaluationController.signal.reason)
                    : '';
                if (hasRenderedCoreResults) {
                    alert('Core evaluation is ready, but interview questions are taking too long. You can use current results now and retry for full question generation if needed.');
                } else if (abortReason === 'max-timeout') {
                    alert('Evaluation reached maximum processing time (8 minutes). Please try again with a shorter JD or fewer resumes.');
                } else {
                    alert('Evaluation timed out due to no progress for 3 minutes. Please try again with a shorter JD or fewer resumes.');
                }
            } else {
                alert('An error occurred while evaluating the resume: ' + error.message);
            }
        } finally {
            clearTimeout(inactivityTimer);
            clearTimeout(maxTimer);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Evaluate resume <i class="bi bi-person-check" aria-hidden="true"></i>';
            setTimeout(() => hideMatchStatus(), 1800);
        }
    });

    function displayMatchPreview(data) {
        if (!resultDiv) return;
        const pct = Number(data.match_percentage || 0);
        const pctStr = data.match_percentage_str || pct + '%';
        const progressBar = document.getElementById('progress-bar');
        const matchScore = document.getElementById('match-score');
        const ring = document.getElementById('match-score-ring');
        if (progressBar) {
            progressBar.style.width = pct + '%';
            progressBar.textContent = pctStr;
        }
        if (matchScore) matchScore.textContent = pctStr;
        if (ring) ring.style.setProperty('--score', String(pct));
        applyMatchScoreTier(pct);
    }

    function displayBasicResults(data) {
        if (!resultDiv) return;

        // Store evaluation data for PDF generation
        currentEvaluationData = data;

        // Match Score
        document.getElementById('progress-bar').style.width = data.match_percentage + '%';
        document.getElementById('progress-bar').textContent = data.match_percentage_str || data.match_percentage + '%';
        document.getElementById('match-score').textContent = data.match_percentage_str || data.match_percentage + '%';
        const ring = document.getElementById('match-score-ring');
        if (ring) ring.style.setProperty('--score', String(data.match_percentage || 0));
        const verdict = document.getElementById('match-score-verdict');
        const subtext = document.getElementById('match-score-subtext');
        const mmReadinessEl = document.getElementById('mm-interview-readiness');
        const mmCueEl = document.getElementById('mm-pluto-cue');
        const score = Number(data.match_percentage || 0);
        applyMatchScoreTier(score);
        if (verdict && subtext) {
            if (score >= 85) {
                verdict.textContent = 'Exceptional Match';
                subtext.textContent = 'Top profile for this role';
            } else if (score >= 70) {
                verdict.textContent = 'Strong Match';
                subtext.textContent = 'Recommended for shortlist';
            } else if (score >= 40) {
                verdict.textContent = 'Moderate Match';
                subtext.textContent = 'Needs deeper screening';
            } else {
                verdict.textContent = 'Weak Match';
                subtext.textContent = 'Significant gap to role';
            }
        }
        if (mmReadinessEl) {
            mmReadinessEl.textContent = score >= 70 ? 'Shortlist ready' : 'Needs deeper screening';
        }
        if (mmCueEl) {
            const missingCount = Array.isArray(data.missing_keywords) ? data.missing_keywords.length : 0;
            mmCueEl.textContent = missingCount > 0
                ? `Probe ${Math.min(missingCount, 3)} missing-skill areas in first interview round.`
                : 'Use quick-check questions to confirm depth before panel handoff.';
        }

        // Candidate identity card details
        const candidateNameEl = document.getElementById('candidate-name');
        const candidateInitialsEl = document.getElementById('candidate-initials');
        const candidateRoleEl = document.getElementById('candidate-role');
        const candidateFileEl = document.getElementById('candidate-file');
        const candidateEmailEl = document.getElementById('candidate-email');
        const candidatePhoneEl = document.getElementById('candidate-phone');
        const candidateLinkedinEl = document.getElementById('candidate-linkedin');
        const roleInput = document.getElementById('job_title');
        const resumeInput = document.getElementById('resume');
        const fileName = resumeInput && resumeInput.files && resumeInput.files[0] ? resumeInput.files[0].name : '';
        const cleanBase = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim() : 'Candidate';
        const prettyName = cleanBase ? cleanBase.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Candidate';
        const ci = data.contact_info || {};
        const extractedName = (ci.name || '').trim();
        const displayName = extractedName || prettyName;
        const initials = displayName.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || 'CA';
        if (candidateNameEl) candidateNameEl.textContent = displayName;
        if (candidateInitialsEl) candidateInitialsEl.textContent = initials;
        if (candidateRoleEl) candidateRoleEl.textContent = (roleInput && roleInput.value.trim()) ? roleInput.value.trim() : 'Role under evaluation';
        if (candidateFileEl) candidateFileEl.textContent = fileName || 'Not set';
        if (candidateEmailEl) candidateEmailEl.textContent = ci.email || 'Not available';
        if (candidatePhoneEl) candidatePhoneEl.textContent = ci.phone || 'Not available';
        if (candidateLinkedinEl) {
            const rawLinkedin = (ci.linkedin || '').trim();
            if (rawLinkedin) {
                const normalized = /^https?:\/\//i.test(rawLinkedin) ? rawLinkedin : `https://${rawLinkedin}`;
                candidateLinkedinEl.textContent = rawLinkedin;
                candidateLinkedinEl.href = normalized;
                candidateLinkedinEl.style.pointerEvents = 'auto';
            } else {
                candidateLinkedinEl.textContent = 'Not available';
                candidateLinkedinEl.removeAttribute('href');
                candidateLinkedinEl.style.pointerEvents = 'none';
            }
        }

        const downloadResumeBtn = document.getElementById('downloadCandidateResumeBtn');
        if (downloadResumeBtn) {
            downloadResumeBtn.onclick = () => {
                const selectedResume = resumeInput && resumeInput.files && resumeInput.files[0] ? resumeInput.files[0] : null;
                if (!selectedResume) {
                    alert('Resume file is not available for download. Please upload again and evaluate.');
                    return;
                }

                const extensionMatch = selectedResume.name.match(/(\.[^.]+)$/);
                const extension = extensionMatch ? extensionMatch[1] : '';
                const rawName = (candidateNameEl && candidateNameEl.textContent ? candidateNameEl.textContent : 'Candidate');
                const compactName = rawName.replace(/[^a-zA-Z0-9]/g, '');
                const safeName = compactName || 'Candidate';
                const targetFileName = `${safeName}_Peoplelogic${extension}`;

                const objectUrl = URL.createObjectURL(selectedResume);
                const anchor = document.createElement('a');
                anchor.href = objectUrl;
                anchor.download = targetFileName;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 500);
            };
        }

        // Match Factors
        const factors = data.match_factors || {};
        updateMatchFactor('skills-match', factors['Skills Match'] || 0);
        updateMatchFactor('experience-match', factors['Experience Match'] || 0);
        updateMatchFactor('education-match', factors['Education Match'] || 0);
        updateMatchFactor('industry-match', factors['Industry Knowledge'] || 0);
        
        // Handle Certification Match - show N/A if null/not applicable
        const certMatch = factors['Certification Match'];
        if (certMatch === null || certMatch === undefined) {
            updateMatchFactorNA('certification-match');
        } else {
            updateMatchFactor('certification-match', certMatch);
        }

        // Profile Summary
        document.getElementById('profile-summary').textContent = data.profile_summary || 'No summary available';
        document.getElementById('missing-keywords').innerHTML = (data.missing_keywords && data.missing_keywords.length > 0)
            ? data.missing_keywords.map(kw => `<span class="badge bg-warning text-dark">${kw}</span>`).join('')
            : '<span class="text-success">No missing keywords</span>';
        
        // NEW: Candidate Fit Analysis
        renderCandidateFitAnalysis(data.candidate_fit_analysis);
        
        // Qualification Fit Assessment - Only show if over/underqualified
        const qualificationText = data.over_under_qualification || '';
        const qualificationCard = document.getElementById('qualification-fit-card');
        const qualificationDiv = document.getElementById('overqualification-analysis');
        
        // Check if content indicates over/underqualification (hide if "perfect fit", "right fit", "well-matched", etc.)
        const hasQualificationConcern = qualificationText && 
            !qualificationText.toLowerCase().includes('perfect fit') &&
            !qualificationText.toLowerCase().includes('right fit') &&
            !qualificationText.toLowerCase().includes('well-matched') &&
            !qualificationText.toLowerCase().includes('appropriately matched') &&
            !qualificationText.toLowerCase().includes('good fit') &&
            (qualificationText.toLowerCase().includes('overqualified') || 
             qualificationText.toLowerCase().includes('underqualified') ||
             qualificationText.toLowerCase().includes('too senior') ||
             qualificationText.toLowerCase().includes('too junior') ||
             qualificationText.toLowerCase().includes('flight risk') ||
             qualificationText.toLowerCase().includes('capability gap'));
        
        if (hasQualificationConcern) {
            qualificationDiv.textContent = qualificationText;
            qualificationCard.style.display = 'block';
        } else {
            qualificationCard.style.display = 'none';
        }

        // Set evaluation ID for feedback
        document.getElementById('evaluation-id').value = data.id;
        
        // Check if feedback already submitted for this evaluation
        if (data.id) {
            checkEvaluationFeedbackExists(data.id);
        }
    }

    function updateMatchFactor(id, value) {
        const element = document.getElementById(id);
        const scoreElement = document.getElementById(id + '-score');
        if (element && scoreElement) {
            element.style.width = value + '%';
            scoreElement.textContent = value + '%';
        }
    }
    
    function updateMatchFactorNA(id) {
        const element = document.getElementById(id);
        const scoreElement = document.getElementById(id + '-score');
        const container = element?.closest('.mb-2');
        const labelElement = container?.querySelector('.form-label');
        if (element && scoreElement) {
            element.style.width = '0%';
            element.style.backgroundColor = 'var(--pl-text-secondary)';
            element.style.opacity = '0.5'; // Make it visually distinct
            scoreElement.textContent = 'N/A';
            scoreElement.className = 'text-muted fst-italic';
            if (labelElement) {
                labelElement.innerHTML = 'Certification Match <small class="text-muted">(Not Applicable)</small>';
            }
        }
    }

    function displayAdditionalData(data) {
        // Job Stability
        if (data.job_stability) {
            const stability = data.job_stability;
            document.getElementById('stability-score-bar').style.width = stability.StabilityScore + '%';
            document.getElementById('stability-score').textContent = stability.StabilityScore;
            document.getElementById('risk-level').textContent = stability.RiskLevel;
            document.getElementById('risk-level').className = 'badge bg-' +
                (stability.RiskLevel === 'Low' ? 'success' : stability.RiskLevel === 'Medium' ? 'warning' : 'danger');
            document.getElementById('average-tenure').textContent = stability.AverageJobTenure;
            document.getElementById('job-count').textContent = stability.JobCount;
            document.getElementById('stability-explanation').textContent = stability.ReasoningExplanation;
        }

        // Red Flags - Only show card if red flags exist
        if (data.career_progression) {
            const progression = data.career_progression;
            const redFlagsDiv = document.getElementById('red-flags');
            const redFlagsCard = document.getElementById('red-flags-card');

            if (progression.red_flags && progression.red_flags.length > 0) {
                redFlagsDiv.innerHTML = progression.red_flags.map(flag => `<div>⚠️ ${flag}</div>`).join('');
                redFlagsCard.style.display = 'block';
            } else {
                redFlagsCard.style.display = 'none';
            }
        }
    }

    function displayQuestions(data) {
        // Quick Checks
        // Helper function to extract question text (handles both string and object formats)
        const extractQuestionText = (q) => {
            if (typeof q === 'string') {
                return q;
            } else if (typeof q === 'object' && q !== null) {
                // Try common property names
                return q.question || q.text || q.content || q.value || JSON.stringify(q);
            }
            return String(q);
        };
        
        const quickChecksList = document.getElementById('quick-checks-questions');
        quickChecksList.innerHTML = (data.behavioral_questions || []).map(q =>
            `<li class="list-group-item">${extractQuestionText(q)}</li>`
        ).join('');

        // Soft Skills
        const softSkillsList = document.getElementById('soft-skills-questions');
        softSkillsList.innerHTML = (data.nontechnical_questions || []).map(q =>
            `<li class="list-group-item">${extractQuestionText(q)}</li>`
        ).join('');

        // Technical Skills
        const techSkillsList = document.getElementById('technical-skills-questions');
        techSkillsList.innerHTML = (data.technical_questions || []).map(q =>
            `<li class="list-group-item">${extractQuestionText(q)}</li>`
        ).join('');
    }

    // Feedback form submission
    feedbackForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (currentRating === 0) {
            alert('Please select a rating before submitting feedback.');
            return;
        }

        const formData = new FormData(feedbackForm);
        const feedbackData = {
            evaluation_id: formData.get('evaluation_id'),
            rating: formData.get('rating'),
            comments: formData.get('comments')
        };

        apiFetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedbackData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error: ' + data.error);
            } else {
                // Hide the feedback form and show success message
                const feedbackCard = feedbackForm.closest('.card');
                if (feedbackCard) {
                    feedbackCard.querySelector('.card-body').innerHTML = `
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle"></i> 
                            <strong>Thank you!</strong> Your feedback has been submitted successfully.
                        </div>
                    `;
                } else {
                    alert('Feedback submitted successfully!');
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while submitting feedback.');
        });
    });

    // Standalone Recruiter Handbook Generation
    const handbookForm = document.getElementById('handbookGenerationForm');
    const generateHandbookBtn = document.getElementById('generateHandbookBtn');
    const downloadHandbookPDFBtn = document.getElementById('downloadHandbookPDF');
    const resetHandbookBtn = document.getElementById('resetHandbookForm');
    const handbookCancelBtn = document.getElementById('handbook-cancel-btn');

    async function streamHandbookGeneration(payload, options) {
        if (window.PlutoHandbookStream && window.PlutoHandbookStream.streamHandbookGeneration) {
            return window.PlutoHandbookStream.streamHandbookGeneration(payload, options);
        }
        const { signal, onDelta, onStatus } = options || {};
        const response = await apiFetch('/api/generate-recruiter-handbook-stream', {
            method: 'POST',
            signal,
            headers: { Accept: 'text/event-stream' },
            body: payload,
        });
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullMarkdown = '';
        let existingPayload = null;
        let handbookId = null;
        let sawExisting = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                let event;
                try {
                    event = JSON.parse(line.slice(6));
                } catch (parseErr) {
                    console.warn('handbook SSE parse skip', parseErr);
                    continue;
                }
                if (event.type === 'meta' && event.message && onStatus) {
                    onStatus(event.message);
                } else if (event.type === 'section' && typeof event.index === 'number') {
                    if (window.advanceHandbookLoaderFromMarkdown) {
                        const fakeMd = '### ' + String(event.index + 1);
                        window.advanceHandbookLoaderFromMarkdown(fakeMd);
                    }
                } else if (event.type === 'existing') {
                    sawExisting = true;
                    existingPayload = event;
                    fullMarkdown = event.markdown_content || fullMarkdown;
                    if (onDelta) onDelta(fullMarkdown);
                } else if (event.type === 'delta') {
                    fullMarkdown += event.content || '';
                    if (onDelta) onDelta(fullMarkdown);
                } else if (event.type === 'done') {
                    handbookId = event.handbook_id;
                    if (event.existing) sawExisting = true;
                    return {
                        success: true,
                        markdown_content: fullMarkdown,
                        handbook_id: handbookId,
                        existing: sawExisting,
                        existingPayload,
                        job_title: payload.job_title,
                        oorwin_job_id: payload.oorwin_job_id,
                    };
                } else if (event.type === 'error') {
                    throw new Error(event.message || 'Handbook generation failed');
                }
            }
        }

        if (!fullMarkdown) {
            throw new Error('Handbook stream ended without content');
        }
        return {
            success: true,
            markdown_content: fullMarkdown,
            handbook_id: handbookId,
            existing: sawExisting,
            existingPayload,
            job_title: payload.job_title,
            oorwin_job_id: payload.oorwin_job_id,
        };
    }

    if (handbookForm) {
        handbookForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const collectFn = window.HandbookIntakeForm?.collectHandbookIntakePayload;
            const validateFn = window.HandbookIntakeForm?.validateHandbookIntake;
            const handbookPayload = collectFn
                ? collectFn(handbookForm)
                : null;

            if (!handbookPayload) {
                alert('Handbook form is not ready. Please refresh the page.');
                return;
            }

            if (validateFn) {
                const check = validateFn(handbookPayload);
                if (!check.ok) {
                    alert(check.message);
                    return;
                }
            }

            const jobTitle = handbookPayload.job_title;
            const jobDescription = handbookPayload.job_description;
            const additionalContext = handbookPayload.additional_context || '';

            // Show loading state
            clearJdQualityScoreDock();
            document.getElementById('handbook-input-section').style.display = 'none';
            document.getElementById('handbook-loading').style.display = 'block';
            document.getElementById('handbook-result-section').style.display = 'none';
            document.getElementById('handbook-error').style.display = 'none';

            if (typeof window.setCopilotHeroVisible === 'function') {
                window.setCopilotHeroVisible(false);
            }

            generateHandbookBtn.disabled = true;

            try {
                const jobId = handbookPayload.oorwin_job_id || '';

                if (window.startHandbookLoader) {
                    window.startHandbookLoader();
                }

                const loaderStatus = document.getElementById('handbook-loader-status');
                if (loaderStatus) loaderStatus.textContent = 'Scoring JD & generating handbook…';

                const controller = new AbortController();
                const handbookTimeout = setTimeout(() => controller.abort(), 180000);
                if (handbookCancelBtn) {
                    handbookCancelBtn.style.display = 'inline-block';
                    handbookCancelBtn.onclick = function () {
                        controller.abort();
                    };
                }

                const handbookContentEl = document.getElementById('handbook-content');
                let renderPending = false;
                let streamedOnce = false;
                const renderHandbookMarkdown = function (markdown) {
                    if (!handbookContentEl || !markdown) return;
                    const htmlContent = marked.parse(markdown);
                    const cleanHTML = DOMPurify.sanitize(htmlContent);
                    delete handbookContentEl.dataset.workspaceBuilt;
                    handbookContentEl.innerHTML = cleanHTML;
                    if (!streamedOnce) {
                        streamedOnce = true;
                        document.getElementById('handbook-loading').style.display = 'none';
                        document.getElementById('handbook-result-section').style.display = 'block';
                    }
                };
                const scheduleHandbookRender = function (markdown) {
                    if (renderPending) return;
                    renderPending = true;
                    requestAnimationFrame(function () {
                        renderPending = false;
                        renderHandbookMarkdown(markdown);
                    });
                };

                const jdPromise = apiFetch('/api/jd-quality-score', {
                    method: 'POST',
                    signal: controller.signal,
                    body: {
                        job_title: jobTitle,
                        job_description: jobDescription,
                    },
                })
                    .then(async function (jdRes) {
                        const jdData = await jdRes.json();
                        if (jdRes.ok && jdData.success) {
                            renderJdQualityScoreDock(jdData);
                        }
                        return jdData;
                    })
                    .catch(function (jdErr) {
                        console.warn('JD quality score request failed:', jdErr);
                        return null;
                    });

                const handbookPromise = streamHandbookGeneration(handbookPayload, {
                    signal: controller.signal,
                    onStatus: function (msg) {
                        if (loaderStatus) loaderStatus.textContent = msg;
                    },
                    onDelta: function (md) {
                        if (window.advanceHandbookLoaderFromMarkdown) {
                            window.advanceHandbookLoaderFromMarkdown(md);
                        }
                        scheduleHandbookRender(md);
                    },
                });

                await jdPromise;
                if (loaderStatus) loaderStatus.textContent = 'Generating recruiter handbook…';

                const data = await handbookPromise;
                clearTimeout(handbookTimeout);

                if (data.success) {
                    if (data.existing) {
                        const modalData = Object.assign(
                            {
                                message:
                                    jobId
                                        ? 'A handbook already exists for Job ID "' +
                                          jobId +
                                          '". Showing existing handbook.'
                                        : 'Showing existing handbook.',
                            },
                            data.existingPayload || data
                        );
                        showExistingHandbookModal(modalData);
                    }

                    currentHandbookContent = data.markdown_content;
                    currentHandbookSummary = '';
                    currentHandbookData = {
                        jobId: jobId || data.oorwin_job_id,
                        jobTitle: data.job_title || jobTitle,
                        jobDescription: jobDescription,
                        additionalContext: additionalContext,
                    };
                    setHandbookResultHeader(currentHandbookData.jobTitle);
                    renderHandbookMarkdown(data.markdown_content);
                    finalizeHandbookResultPresentation(currentHandbookData.jobTitle);

                    if (window.stopHandbookLoader) {
                        window.stopHandbookLoader();
                    }

                    document.getElementById('handbook-loading').style.display = 'none';
                    document.getElementById('handbook-result-section').style.display = 'block';
                    if (typeof window.setCopilotHeroVisible === 'function') {
                        window.setCopilotHeroVisible(false);
                    }

                    if (data.handbook_id) {
                        initializeHandbookFeedback(data.handbook_id);
                    }

                    if (typeof window.scrollToHandbookResult === 'function') {
                        window.scrollToHandbookResult();
                    } else {
                        document.getElementById('handbook-result-section').scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                    }
                } else {
                    throw new Error(data.message || 'Failed to generate handbook');
                }
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('handbook-loading').style.display = 'none';
                document.getElementById('handbook-error').style.display = 'block';
                if (error.name === 'AbortError') {
                    document.getElementById('handbook-error-message').textContent =
                        'Handbook generation was cancelled.';
                } else {
                    document.getElementById('handbook-error-message').textContent = error.message;
                }
                document.getElementById('handbook-input-section').style.display = 'block';
                if (typeof window.setCopilotHeroVisible === 'function') {
                    window.setCopilotHeroVisible(true);
                }
                if (window.stopHandbookLoader) {
                    window.stopHandbookLoader();
                }
            } finally {
                generateHandbookBtn.disabled = false;
                if (handbookCancelBtn) {
                    handbookCancelBtn.style.display = 'none';
                    handbookCancelBtn.onclick = null;
                }
            }
        });
    }

    // Download Evaluation PDF button
    const downloadEvaluationPDFBtn = document.getElementById('downloadEvaluationPDF');
    if (downloadEvaluationPDFBtn) {
        downloadEvaluationPDFBtn.addEventListener('click', async function() {
            if (!currentEvaluationData) {
                alert('No evaluation data to download.');
                return;
            }

            downloadEvaluationPDFBtn.disabled = true;
            downloadEvaluationPDFBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating PDF...';

            try {
                const response = await apiFetch('/api/download-evaluation-pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        evaluation_data: currentEvaluationData
                    })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    const filename = currentEvaluationData.filename || 'Resume_Evaluation';
                    const timestamp = new Date().getTime();
                    a.download = `Resume_Evaluation_${filename}_${timestamp}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    const data = await response.json();
                    throw new Error(data.message || 'Failed to generate PDF');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to download PDF: ' + error.message);
            } finally {
                downloadEvaluationPDFBtn.disabled = false;
                downloadEvaluationPDFBtn.innerHTML = '<i class="bi bi-download"></i> Download PDF';
            }
        });
    }

    // Download PDF button
    if (downloadHandbookPDFBtn) {
        downloadHandbookPDFBtn.addEventListener('click', async function() {
            if (!currentHandbookContent) {
                alert('No handbook content to download.');
                return;
            }

            downloadHandbookPDFBtn.disabled = true;
            downloadHandbookPDFBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating PDF...';

            try {
                const response = await apiFetch('/api/download-handbook-pdf', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        markdown_content: currentHandbookContent,
                        job_title: (currentHandbookData && currentHandbookData.jobTitle) ? currentHandbookData.jobTitle : '',
                        oorwin_job_id: (currentHandbookData && currentHandbookData.jobId) ? currentHandbookData.jobId : ''
                    })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    // Filename format: Recruiter_Handbook_{Job_Title}.pdf
                    const rawTitle = (currentHandbookData && currentHandbookData.jobTitle) ? currentHandbookData.jobTitle : '';
                    const safeTitle = rawTitle
                        .toString()
                        .trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/\s+/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_+|_+$/g, '');
                    a.download = `Recruiter_Handbook_${safeTitle || 'Handbook'}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    const data = await response.json();
                    throw new Error(data.message || 'Failed to generate PDF');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Failed to download PDF: ' + error.message);
            } finally {
                downloadHandbookPDFBtn.disabled = false;
                downloadHandbookPDFBtn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i> Download PDF';
            }
        });
    }

    // Reset button to generate new handbook
    if (resetHandbookBtn) {
        resetHandbookBtn.addEventListener('click', function() {
            document.getElementById('handbook-result-section').style.display = 'none';
            document.getElementById('handbook-input-section').style.display = 'block';
            document.getElementById('handbook-error').style.display = 'none';
            clearJdQualityScoreDock();
            if (typeof window.setCopilotHeroVisible === 'function') {
                window.setCopilotHeroVisible(true);
            }
            currentHandbookContent = '';
            currentHandbookSummary = '';
            currentHandbookData = null;
            handbookForm.reset();
            if (window.HandbookIntakeForm?.resetHandbookIntakeForm) {
                window.HandbookIntakeForm.resetHandbookIntakeForm();
            }
        });
    }

    // Function to switch to Match Maker tab and auto-fill with handbook data
    // Check if we're in view mode (viewing stored evaluation or handbook)
    function checkForViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const viewHandbook = urlParams.get('view_handbook');
        const viewEvaluation = urlParams.get('view_evaluation');
        
        console.log('Checking view mode:', { viewHandbook, viewEvaluation });
        
        if (viewHandbook) {
            const handbookData = sessionStorage.getItem('viewHandbookData');
            console.log('Handbook data from storage:', handbookData ? 'Found' : 'Not found');
            if (handbookData) {
                const handbook = JSON.parse(handbookData);
                console.log('Displaying stored handbook');
                displayStoredHandbook(handbook);
                sessionStorage.removeItem('viewHandbookData'); // Clean up
            }
        } else if (viewEvaluation) {
            const evaluationData = sessionStorage.getItem('viewEvaluationData');
            console.log('Evaluation data from storage:', evaluationData ? 'Found' : 'Not found');
            if (evaluationData) {
                const evaluation = JSON.parse(evaluationData);
                console.log('Displaying stored evaluation');
                displayStoredEvaluation(evaluation);
                sessionStorage.removeItem('viewEvaluationData'); // Clean up
            }
        }
    }
    
    // Display a stored handbook (from history)
    function displayStoredHandbook(handbook) {
        // Function to try switching to handbook with retries (sidebar or copilot cards)
        function switchToHandbook(retries = 0) {
            const handbookSidebarItem = document.querySelector('.sidebar-item[data-section="handbook"]');
            const hasCopilot = document.querySelector('[data-copilot-module="handbook"]');
            if (window.activateCopilotSection && hasCopilot) {
                window.activateCopilotSection('handbook');
                console.log('Switched to Handbook section (copilot nav)');
                return true;
            }
            console.log('Attempt', retries + 1, '- Handbook sidebar item:', handbookSidebarItem ? 'Found' : 'Not found');
            
            if (handbookSidebarItem) {
                document.querySelectorAll('.sidebar-item').forEach(item => {
                    item.classList.remove('active');
                });
                handbookSidebarItem.classList.add('active');
                const handbookSection = document.getElementById('handbook-section');
                const matchmakerSection = document.getElementById('matchmaker-section');
                if (handbookSection) handbookSection.style.display = 'block';
                if (matchmakerSection) matchmakerSection.style.display = 'none';
                console.log('Switched to Handbook section');
                return true;
            }
            if (retries < 5) {
                setTimeout(() => switchToHandbook(retries + 1), 100);
                return false;
            }
            return false;
        }
        
        // Try to switch to handbook
        switchToHandbook();
        clearJdQualityScoreDock();

        // Wait for section to be visible before displaying content
        setTimeout(() => {
            // Hide input section, show result section
            document.getElementById('handbook-input-section').style.display = 'none';
            document.getElementById('handbook-loading').style.display = 'none';
            document.getElementById('handbook-error').style.display = 'none';
            document.getElementById('handbook-result-section').style.display = 'block';
            
            // Render the handbook content using marked.js
            const handbookContentDiv = document.getElementById('handbook-content');
                if (handbook.markdown_content && handbookContentDiv) {
                const rawHtml = marked.parse(handbook.markdown_content);
                delete handbookContentDiv.dataset.workspaceBuilt;
                handbookContentDiv.innerHTML = DOMPurify.sanitize(rawHtml);
                // Post-process formatting for clearer hierarchy
                const storedTitle = handbook.job_title || '';
                finalizeHandbookResultPresentation(storedTitle);
                setHandbookResultHeader(storedTitle);
                if (handbook.id) {
                    initializeHandbookFeedback(handbook.id);
                }
            }
            
            // Store for PDF generation
            currentHandbookContent = handbook.markdown_content;
            currentHandbookSummary = '';
            currentHandbookData = {
                jobId: handbook.oorwin_job_id || '',
                jobTitle: handbook.job_title || '',
                jobDescription: handbook.job_description || ''
            };
            
            if (typeof window.setCopilotHeroVisible === 'function') {
                window.setCopilotHeroVisible(false);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300); // Wait for sidebar animation
    }
    
    // Display a stored evaluation (from history)
    function displayStoredEvaluation(evaluation) {
        console.log('displayStoredEvaluation called');
        
        function switchToMatchMaker(retries = 0) {
            const matchmakerSidebarItem = document.querySelector('.sidebar-item[data-section="matchmaker"]');
            const hasCopilot = document.querySelector('[data-copilot-module="matchmaker"]');
            if (window.activateCopilotSection && hasCopilot) {
                window.activateCopilotSection('matchmaker');
                console.log('Switched to Match Maker section (copilot nav)');
                return true;
            }
            console.log('Attempt', retries + 1, '- Matchmaker sidebar item:', matchmakerSidebarItem ? 'Found' : 'Not found');
            
            if (matchmakerSidebarItem) {
                document.querySelectorAll('.sidebar-item').forEach(item => {
                    item.classList.remove('active');
                });
                matchmakerSidebarItem.classList.add('active');
                const handbookSection = document.getElementById('handbook-section');
                const matchmakerSection = document.getElementById('matchmaker-section');
                if (handbookSection) handbookSection.style.display = 'none';
                if (matchmakerSection) matchmakerSection.style.display = 'block';
                console.log('Switched to Match Maker section');
                return true;
            }
            if (retries < 5) {
                setTimeout(() => switchToMatchMaker(retries + 1), 100);
                return false;
            }
            return false;
        }
        
        // Try to switch to matchmaker
        switchToMatchMaker();
        
        // Wait for section to be visible before displaying content
        setTimeout(() => {
            console.log('Timeout complete, displaying content');
            // Hide form card, show results
            const matchmakerInputWrap = document.getElementById('matchmaker-input-wrap');
            const evaluationForm = document.getElementById('evaluationForm');
            if (matchmakerInputWrap) {
                matchmakerInputWrap.style.display = 'none';
            } else if (evaluationForm && evaluationForm.closest('.card')) {
                evaluationForm.closest('.card').parentElement.style.display = 'none';
            }
            document.getElementById('evaluation-result').style.display = 'block';
            expandAllEvalSections();
            markAllEvalSectionsReady();

            // Display using the same functions as real-time evaluation
            console.log('Calling displayBasicResults');
            displayBasicResults(evaluation);
            
            console.log('Calling displayAdditionalData');
            displayAdditionalData(evaluation);
            
            // Display interview questions if available
            if (evaluation.technical_questions || evaluation.nontechnical_questions || evaluation.behavioral_questions) {
                console.log('Displaying questions');
                const quickChecksList = document.getElementById('quick-checks-questions');
                const softSkillsList = document.getElementById('soft-skills-questions');
                const skillChecksList = document.getElementById('technical-skills-questions');
                
                // Helper function to extract question text (handles both string and object formats)
                const extractQuestionText = (q) => {
                    if (typeof q === 'string') {
                        return q;
                    } else if (typeof q === 'object' && q !== null) {
                        // Try common property names
                        return q.question || q.text || q.content || q.value || JSON.stringify(q);
                    }
                    return String(q);
                };
                
                // Quick Checks = Behavioral Questions
                if (quickChecksList && evaluation.behavioral_questions && evaluation.behavioral_questions.length > 0) {
                    quickChecksList.innerHTML = evaluation.behavioral_questions.map(q => 
                        `<li class="list-group-item">${extractQuestionText(q)}</li>`
                    ).join('');
                } else if (quickChecksList) {
                    quickChecksList.innerHTML = '<li class="list-group-item text-muted">No behavioral questions available</li>';
                }
                
                // Soft Skills = Non-Technical Questions
                if (softSkillsList && evaluation.nontechnical_questions && evaluation.nontechnical_questions.length > 0) {
                    softSkillsList.innerHTML = evaluation.nontechnical_questions.map(q => 
                        `<li class="list-group-item">${extractQuestionText(q)}</li>`
                    ).join('');
                } else if (softSkillsList) {
                    softSkillsList.innerHTML = '<li class="list-group-item text-muted">No non-technical questions available</li>';
                }
                
                // Skill Checks = Technical Questions
                if (skillChecksList && evaluation.technical_questions && evaluation.technical_questions.length > 0) {
                    skillChecksList.innerHTML = evaluation.technical_questions.map(q => 
                        `<li class="list-group-item">${extractQuestionText(q)}</li>`
                    ).join('');
                } else if (skillChecksList) {
                    skillChecksList.innerHTML = '<li class="list-group-item text-muted">No technical questions available</li>';
                }
            }
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 300); // Wait for sidebar animation
    }
    
    function evaluateCandidatesFromHandbook() {
        if (!currentHandbookData) {
            alert('No handbook data available. Please generate a handbook first.');
            return;
        }
        
        // Auto-fill Match Maker form
        const jobIdInput = document.getElementById('oorwin_job_id');
        const jobTitleInput = document.getElementById('job_title');
        const jobDescTextarea = document.getElementById('job_description');
        const evalAdditionalContext = document.getElementById('evaluation_additional_context');
        
        if (jobIdInput && currentHandbookData.jobId) {
            jobIdInput.value = currentHandbookData.jobId;
        }
        if (jobTitleInput) {
            jobTitleInput.value = currentHandbookData.jobTitle;
        }
        if (jobDescTextarea) {
            jobDescTextarea.value = currentHandbookData.jobDescription;
        }
        if (evalAdditionalContext) {
            evalAdditionalContext.value = currentHandbookData.additionalContext || '';
        }
        
        function showReadyToEvaluateNotice() {
            const notification = document.createElement('div');
            notification.className = 'alert alert-info alert-dismissible fade show';
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
            notification.innerHTML = `
                <strong>✓ Ready to Evaluate!</strong>
                Job details have been auto-filled. Upload candidate resume(s) to start evaluating.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 150);
            }, 5000);
        }

        if (window.activateCopilotSection && document.querySelector('[data-copilot-module="matchmaker"]')) {
            window.activateCopilotSection('matchmaker');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showReadyToEvaluateNotice();
        } else {
            const matchmakerSidebarItem = document.querySelector('.sidebar-item[data-section="matchmaker"]');
            if (matchmakerSidebarItem) {
                matchmakerSidebarItem.click();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showReadyToEvaluateNotice();
            }
        }
    }
    
    // "Evaluate Candidates Now" button (top banner)
    const evaluateCandidatesBtn = document.getElementById('evaluateCandidatesFromHandbook');
    if (evaluateCandidatesBtn) {
        evaluateCandidatesBtn.addEventListener('click', function() {
            evaluateCandidatesFromHandbook();
        });
    }
    
    // "Start Evaluating" button (bottom footer)
    const evaluateCandidatesFooterBtn = document.getElementById('evaluateCandidatesFromHandbookFooter');
    if (evaluateCandidatesFooterBtn) {
        evaluateCandidatesFooterBtn.addEventListener('click', function() {
            evaluateCandidatesFromHandbook();
        });
    }

    const railEvaluateBtn = document.getElementById('railEvaluateCandidates');
    if (railEvaluateBtn) {
        railEvaluateBtn.addEventListener('click', function() {
            evaluateCandidatesFromHandbook();
        });
    }

    const railDownloadBtn = document.getElementById('railDownloadHandbook');
    if (railDownloadBtn) {
        railDownloadBtn.addEventListener('click', function() {
            if (downloadHandbookPDFBtn) downloadHandbookPDFBtn.click();
        });
    }
    
    // Auto-fill from history when Oorwin Job ID is entered or selected
    bindOorwinJobIdAutofill(
        document.getElementById('handbook_oorwin_job_id'),
        autoFillJobDescription
    );
    bindOorwinJobIdAutofill(
        document.getElementById('oorwin_job_id'),
        autoFillMatchMakerFields
    );

    // Deep link from Job History: ?job_id=… → MatchMaker tab + pre-fill JD fields (needs activateCopilotSection).
    const bootParams = new URLSearchParams(window.location.search);
    const bootJobId = bootParams.get('job_id');
    const bootSection =
        bootParams.get('section') || (bootJobId ? 'matchmaker' : '');
    if (bootSection) {
        window.activateCopilotSection(bootSection);
    }
    if (bootJobId && typeof window.checkUrlParameterAndAutoFill === 'function') {
        window.checkUrlParameterAndAutoFill();
    }

    // Add event listener for handbook history tab
    // Event listeners for context-specific history tabs removed
    // Users should use the main /history page for viewing all handbooks and evaluations

});

// Helper functions
function getLevelColor(level) {
    const colors = {
        'Entry': 'secondary',
        'Mid': 'info',
        'Senior': 'primary',
        'Lead': 'success',
        'Manager': 'warning'
    };
    return colors[level] || 'secondary';
}

function getProgressionColor(progression) {
    const colors = {
        'Promotion': 'success',
        'Lateral': 'warning',
        'Step Back': 'danger'
    };
    return colors[progression] || 'secondary';
}

// Load JobID suggestions for auto-suggest
async function loadJobIdSuggestions() {
    try {
        const response = await apiFetch('/api/get-job-ids');
        const data = await response.json();
        
        if (data.success && data.job_ids) {
            // Populate datalist for Match Maker form
            const jobIdDatalist = document.getElementById('jobIdSuggestions');
            if (jobIdDatalist) {
                jobIdDatalist.innerHTML = data.job_ids.map(id => 
                    `<option value="${id}">`
                ).join('');
            }
            
            // Populate datalist for Handbook form
            const handbookJobIdDatalist = document.getElementById('handbookJobIdSuggestions');
            if (handbookJobIdDatalist) {
                handbookJobIdDatalist.innerHTML = data.job_ids.map(id => 
                    `<option value="${id}">`
                ).join('');
            }
        }
    } catch (error) {
        console.error('Error loading JobID suggestions:', error);
    }
}

// Auto-fill handbook fields based on JobID
async function autoFillJobDescription(jobId) {
    try {
        const response = await apiFetch(`/api/get-job-data/${encodeURIComponent(jobId)}`);
        const data = await response.json();
        
        if (data.success) {
            if (window.HandbookIntakeForm?.populateHandbookIntakeForm) {
                window.HandbookIntakeForm.populateHandbookIntakeForm(data);
            } else {
                const jobTitleInput = document.getElementById('handbook_job_title');
                const jobDescTextarea = document.getElementById('handbook_job_description');
                const additionalContextTextarea = document.getElementById('handbook_additional_context');
                if (jobTitleInput && !jobTitleInput.value.trim() && data.job_title) {
                    jobTitleInput.value = data.job_title;
                }
                if (jobDescTextarea && !jobDescTextarea.value.trim() && data.job_description) {
                    jobDescTextarea.value = data.job_description;
                }
                if (additionalContextTextarea && !additionalContextTextarea.value.trim() && data.additional_context) {
                    additionalContextTextarea.value = data.additional_context;
                }
            }

            const jobDescTextarea = document.getElementById('handbook_job_description');
            const shouldNotify =
                data.job_title || data.job_description || data.intake;

            if (shouldNotify && jobDescTextarea) {
                const notification = document.createElement('small');
                notification.className = 'text-success';
                notification.textContent = `✓ Auto-filled from ${data.source}`;
                jobDescTextarea.parentElement.appendChild(notification);
                setTimeout(() => notification.remove(), 3000);
            }
        }
    } catch (error) {
        console.error('Error auto-filling job description:', error);
    }
}

// Auto-fill Match Maker fields based on JobID
async function autoFillMatchMakerFields(jobId) {
    try {
        const response = await apiFetch(`/api/get-job-data/${encodeURIComponent(jobId)}`);
        const data = await response.json();

        if (data.success) {
            const jobTitleInput = document.getElementById('job_title');
            const jobDescTextarea = document.getElementById('job_description');
            const additionalContextTextarea = document.getElementById('evaluation_additional_context');
            const shouldFillTitle = jobTitleInput && !jobTitleInput.value.trim() && data.job_title;
            const shouldFillDescription = jobDescTextarea && !jobDescTextarea.value.trim() && data.job_description;
            const shouldFillContext = additionalContextTextarea && !additionalContextTextarea.value.trim() && data.additional_context;

            if (shouldFillTitle) {
                jobTitleInput.value = data.job_title;
            }

            if (shouldFillDescription) {
                jobDescTextarea.value = data.job_description;
            }

            if (shouldFillContext) {
                additionalContextTextarea.value = data.additional_context;
            }

            if (shouldFillTitle || shouldFillDescription || shouldFillContext) {
                const notification = document.createElement('small');
                notification.className = 'text-success';
                notification.textContent = `✓ Auto-filled from ${data.source}`;
                jobDescTextarea.parentElement.appendChild(notification);

                setTimeout(() => notification.remove(), 3000);
            }
        }
    } catch (error) {
        console.error('Error auto-filling Match Maker fields:', error);
    }
}

// Check URL parameter and auto-fill form if job_id is present
window.checkUrlParameterAndAutoFill = async function checkUrlParameterAndAutoFill() {
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('job_id');
    
    if (!jobId) return; // No job_id parameter, skip
    
    console.log('Found job_id in URL:', jobId);
    
    try {
        const response = await apiFetch(`/api/get-job-data/${encodeURIComponent(jobId)}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('API Response data:', data);
            
            // Auto-fill Match Maker form (not handbook form)
            const jobIdInput = document.getElementById('oorwin_job_id');
            const jobTitleInput = document.getElementById('job_title');
            const jobDescTextarea = document.getElementById('job_description');
            const additionalContextTextarea = document.getElementById(
                'evaluation_additional_context'
            );
            
            console.log('Form elements found:', {
                jobIdInput: !!jobIdInput,
                jobTitleInput: !!jobTitleInput,
                jobDescTextarea: !!jobDescTextarea
            });
            
            if (jobIdInput) {
                jobIdInput.value = jobId;
                console.log('Set JobID to:', jobId);
                // Trigger input event to ensure form recognizes the value
                jobIdInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                console.error('oorwin_job_id input field not found!');
            }
            if (jobTitleInput) {
                jobTitleInput.value = data.job_title || '';
                console.log('Set Job Title to:', data.job_title);
            }
            if (additionalContextTextarea && (data.additional_context || '').trim()) {
                additionalContextTextarea.value = data.additional_context;
            }

            if (jobDescTextarea) {
                const jdValue = data.job_description || '';
                jobDescTextarea.value = jdValue;
                console.log('Set Job Description length:', jdValue.length);
                console.log('Job Description preview:', jdValue.substring(0, 100));
                
                // Verify it was set
                setTimeout(() => {
                    console.log('Verifying after 100ms - JD field value length:', jobDescTextarea.value.length);
                    if (jobDescTextarea.value.length === 0 && jdValue.length > 0) {
                        console.error('JD field was cleared! Attempting to set again...');
                        jobDescTextarea.value = jdValue;
                    }
                }, 100);
            }
            
            // MatchMaker panel + hero updates were applied via activateCopilotSection (resume-evaluator boot).
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'alert alert-success alert-dismissible fade show';
            notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
            notification.innerHTML = `
                <strong>✓ Job Loaded!</strong> 
                JobID: <strong>${jobId}</strong> has been loaded. 
                You can now upload resume(s) to evaluate candidates.
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            document.body.appendChild(notification);
            
            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 150);
            }, 5000);
            
            console.log('Auto-filled form with job data from:', data.source);
        } else {
            console.warn('Job data not found for JobID:', jobId);
            alert(`JobID "${jobId}" not found in database. Please check the JobID or create a new handbook first.`);
        }
    } catch (error) {
        console.error('Error loading job data from URL parameter:', error);
    }
}

// Enhance formatting of Screening Framework and similar blocks
function enhanceHandbookFormatting() {
    const container = document.getElementById('handbook-content');
    if (!container) return;

    // STEP 1: First, ensure all headings have IDs (before any DOM manipulation)
    let headings = Array.from(container.querySelectorAll('h1, h2, h3, h4')).filter(h => {
        const text = h.textContent.trim();
        return text && text.length > 0;
    });
    
    headings.forEach((h, idx) => {
        if (!h.id || h.id === '') {
            let id = (h.textContent || '').trim().toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            if (!id || id.length === 0) {
                id = `section-${idx + 1}`;
            }
            
            let finalId = id;
            let counter = 1;
            while (document.getElementById(finalId)) {
                finalId = `${id}-${counter}`;
                counter++;
            }
            
            h.id = finalId;
        }
    });

    // Ensure anchor targets exist for specific sections even when rendered as <strong> labels
    const ensureAnchorForLabel = (regex, fallbackId) => {
        // Try headings first
        let el = Array.from(container.querySelectorAll('h1,h2,h3,h4,strong,b'))
            .find(node => regex.test((node.textContent || '').trim()));
        if (el) {
            // If it's a <strong>/<b> inside a paragraph, prefer the parent block as anchor target
            if ((el.tagName === 'STRONG' || el.tagName === 'B') && el.parentElement) {
                el = el.parentElement;
            }
            if (!el.id) {
                el.id = fallbackId;
            }
            // Add scroll margin for fixed header offset
            el.style.scrollMarginTop = '120px';
        }
        return el ? el.id : null;
    };

    const screeningId = ensureAnchorForLabel(/^\s*2\.?\s*Screening\s+Framework/i, 'screening-framework');
    const poolsId = ensureAnchorForLabel(/^\s*3\.?\s*Target\s+Talent\s+Pools/i, 'target-talent-pools');

    // STEP 1b: If there are no H2/H3 headings, convert known section titles (exact matches) into H2s
    let hasRealHeadings = container.querySelector('h2, h3') !== null;
    if (!hasRealHeadings) {
        const sectionPatterns = [
            { regex: /^Introduction\s*:?\s*$/i, id: 'introduction' },
            { regex: /^\s*1\.?\s*Primary\s+Sourcing\s+Parameters\s*\(Must-Have\)\s*:?\s*$/i, id: 'primary-sourcing-parameters-must-have' },
            { regex: /^\s*2\.?\s*Screening\s+Framework\s*:?\s*$/i, id: 'screening-framework' },
            { regex: /^\s*3\.?\s*Target\s+Talent\s+Pools\s*:?\s*$/i, id: 'target-talent-pools' },
            { regex: /^\s*4\.?\s*Red\s+Flags\s+to\s+Watch\s*:?\s*$/i, id: 'red-flags-to-watch' },
            { regex: /^\s*5\.?\s*Recruiter\s+Checklist\s*\(Pre-call\)\s*:?\s*$/i, id: 'recruiter-checklist' },
            { regex: /^\s*6\.?\s*Recruiter\s+Sales\s+Pitch\s*\(to\s+candidates\)\s*:?\s*$/i, id: 'recruiter-sales-pitch' },
            { regex: /^\s*7\.?\s*Overqualification\/Overkill\s+Risk\s+Assessment\s*:?\s*$/i, id: 'overqualification-risk-assessment' },
            // Variants without leading numbers
            { regex: /^Primary\s+Sourcing\s+Parameters\s*\(Must-Have\)\s*:?\s*$/i, id: 'primary-sourcing-parameters-must-have' },
            { regex: /^Screening\s+Framework\s*:?\s*$/i, id: 'screening-framework' },
            { regex: /^Target\s+Talent\s+Pools\s*:?\s*$/i, id: 'target-talent-pools' },
            { regex: /^Red\s+Flags\s+to\s+Watch\s*:?\s*$/i, id: 'red-flags-to-watch' },
            { regex: /^Recruiter\s+Sales\s+Pitch\s*\(to\s+candidates\)\s*:?\s*$/i, id: 'recruiter-sales-pitch' },
            { regex: /^Recruiter\s+Checklist\s*\(Pre-call\)\s*:?\s*$/i, id: 'recruiter-checklist' },
            { regex: /^Overqualification\/Overkill\s+Risk\s+Assessment\s*:?\s*$/i, id: 'overqualification-risk-assessment' },
        ];

        const blocks = Array.from(container.querySelectorAll('p, strong, b, div'));
        blocks.forEach((el) => {
            const textRaw = (el.textContent || '').trim();
            if (!textRaw) return;

            const pattern = sectionPatterns.find(({ regex }) => regex.test(textRaw));
            if (!pattern) return;

            const heading = document.createElement('h2');
            const headingText = textRaw.replace(/\s*:$/,'').trim();
            heading.textContent = headingText;

            let baseId = pattern.id;
            if (!baseId) {
                baseId = headingText.toLowerCase()
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-');
            }
            let finalId = baseId;
            let counter = 1;
            while (document.getElementById(finalId)) {
                finalId = `${baseId}-${counter}`;
                counter += 1;
            }
            heading.id = finalId;

            el.parentNode.insertBefore(heading, el);

            // Remove the original element if it only contained the heading label
            el.remove();
        });
    }

    // STEP 1c: After potential conversions, refresh heading list and apply classes/IDs
    let refreshedHeadings = Array.from(container.querySelectorAll('h1, h2, h3, h4')).filter(h => {
        const text = (h.textContent || '').trim();
        return text && text.length > 0;
    });

    refreshedHeadings.forEach((h, idx) => {
        if (!h.id || h.id === '') {
            let id = (h.textContent || '').trim().toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!id || id.length === 0) {
                id = `section-${idx + 1}`;
            }
            let finalId = id;
            let counter = 1;
            while (document.getElementById(finalId)) {
                finalId = `${id}-${counter}`;
                counter += 1;
            }
            h.id = finalId;
        }
    });

    // STEP 1d: Add blue color class to the seven main section titles (exclude Introduction)
    const mainSectionTitles = [
        /^\s*\d+\.?\s*Primary\s+Sourcing\s+Parameters\s*\(Must-Have\)\s*:?\s*$/i,
        /^\s*\d+\.?\s*Screening\s+Framework\s*:?\s*$/i,
        /^\s*\d+\.?\s*Target\s+Talent\s+Pools\s*:?\s*$/i,
        /^\s*\d+\.?\s*Red\s+Flags\s+to\s+Watch\s*:?\s*$/i,
        /^\s*\d+\.?\s*Recruiter\s+Checklist\s*\(Pre-call\)\s*:?\s*$/i,
        /^\s*\d+\.?\s*Recruiter\s+Sales\s+Pitch\s*\(to\s+candidates\)\s*:?\s*$/i,
        /^\s*\d+\.?\s*Overqualification\/Overkill\s+Risk\s+Assessment\s*:?\s*$/i,
        /^Primary\s+Sourcing\s+Parameters\s*\(Must-Have\)\s*:?\s*$/i,
        /^Screening\s+Framework\s*:?\s*$/i,
        /^Target\s+Talent\s+Pools\s*:?\s*$/i,
        /^Red\s+Flags\s+to\s+Watch\s*:?\s*$/i,
        /^Recruiter\s+Checklist\s*\(Pre-call\)\s*:?\s*$/i,
        /^Recruiter\s+Sales\s+Pitch\s*\(to\s+candidates\)\s*:?\s*$/i,
        /^Overqualification\/Overkill\s+Risk\s+Assessment\s*:?\s*$/i,
    ];

    refreshedHeadings.forEach((h) => {
        const text = (h.textContent || '').trim();
        if (/^Introduction\b/i.test(text)) {
            h.classList.remove('main-section-title');
            return;
        }
        const isMainSection = mainSectionTitles.some(regex => regex.test(text));
        if (isMainSection) {
            h.classList.add('main-section-title');
        } else {
            h.classList.remove('main-section-title');
        }
    });

    // Replace the original headings list with the refreshed one for subsequent steps
    headings = refreshedHeadings;

    // STEP 1e: Clean up the first paragraph if it starts with "Introduction"
    const firstParagraph = container.querySelector('p');
    if (firstParagraph && !firstParagraph.previousElementSibling) {
        const originalHTML = firstParagraph.innerHTML;
        const cleanedHTML = originalHTML.replace(/^(\s*<(strong|b)>\s*)?Introduction\s*:?\s*(<\/(strong|b)>\s*)?/i, '').trim();
        if (cleanedHTML !== originalHTML.trim()) {
            firstParagraph.innerHTML = cleanedHTML;
        }
    }

    // STEP 2: Make A./B./C. category titles appear on their own line and slightly smaller
    const items = container.querySelectorAll('li');
    items.forEach(li => {
        const html = li.innerHTML.trim();
        // Pattern: A. Title - rest of text
        const match = html.match(/^([A-G])\.(\s*)([^\-–:]+?)(\s*[-–:])\s*(.*)$/);
        if (match) {
            const category = `${match[1]}. ${match[3].trim()}`;
            const rest = match[5];
            li.innerHTML = `<span class="sf-category">${category}</span><div class="sf-detail">${rest}</div>`;
        }
    });

    // STEP 3: Fix "Likely Companies" and "Likely Titles" - split comma-separated items into separate bullets
    const targetTalentSection = Array.from(container.querySelectorAll('h2, h3')).find(h => 
        /target talent pools/i.test(h.textContent)
    );
    
    if (targetTalentSection) {
        let current = targetTalentSection.nextElementSibling;
        let foundCompanies = false;
        let foundTitles = false;
        
        while (current && current.tagName !== 'H2' && current.tagName !== 'H3') {
            // Check if this is a paragraph or list containing "Likely Companies"
            if (current.tagName === 'P' && /likely companies/i.test(current.textContent)) {
                const text = current.textContent;
                const companiesMatch = text.match(/likely companies[:\s]+(.*)/i);
                if (companiesMatch && companiesMatch[1]) {
                    const companies = companiesMatch[1].split(',').map(c => c.trim()).filter(c => c);
                    if (companies.length > 0) {
                        const ul = document.createElement('ul');
                        companies.forEach(company => {
                            const li = document.createElement('li');
                            li.textContent = company;
                            ul.appendChild(li);
                        });
                        current.replaceWith(ul);
                        foundCompanies = true;
                    }
                }
            }
            
            // Check if this is a paragraph or list containing "Likely Titles"
            if (current.tagName === 'P' && /likely titles/i.test(current.textContent)) {
                const text = current.textContent;
                const titlesMatch = text.match(/likely titles[:\s]+(.*)/i);
                if (titlesMatch && titlesMatch[1]) {
                    const titles = titlesMatch[1].split(',').map(t => t.trim()).filter(t => t);
                    if (titles.length > 0) {
                        const ul = document.createElement('ul');
                        titles.forEach(title => {
                            const li = document.createElement('li');
                            li.textContent = title;
                            ul.appendChild(li);
                        });
                        current.replaceWith(ul);
                        foundTitles = true;
                    }
                }
            }
            
            // Check if it's a list item with comma-separated values
            if (current.tagName === 'LI') {
                const text = current.textContent.trim();
                if (/likely companies/i.test(text) && text.includes(',')) {
                    const parts = text.split(/likely companies[:\s]+/i);
                    if (parts.length > 1) {
                        const companies = parts[1].split(',').map(c => c.trim()).filter(c => c);
                        if (companies.length > 1) {
                            const parent = current.parentElement;
                            const index = Array.from(parent.children).indexOf(current);
                            current.textContent = 'Likely Companies:';
                            companies.forEach(company => {
                                const newLi = document.createElement('li');
                                newLi.textContent = company;
                                parent.insertBefore(newLi, parent.children[index + 1]);
                            });
                            foundCompanies = true;
                        }
                    }
                }
                if (/likely titles/i.test(text) && text.includes(',')) {
                    const parts = text.split(/likely titles[:\s]+/i);
                    if (parts.length > 1) {
                        const titles = parts[1].split(',').map(t => t.trim()).filter(t => t);
                        if (titles.length > 1) {
                            const parent = current.parentElement;
                            const index = Array.from(parent.children).indexOf(current);
                            current.textContent = 'Likely Titles:';
                            titles.forEach(title => {
                                const newLi = document.createElement('li');
                                newLi.textContent = title;
                                parent.insertBefore(newLi, parent.children[index + 1]);
                            });
                            foundTitles = true;
                        }
                    }
                }
            }
            
            current = current.nextElementSibling;
        }
    }

    // STEP 4: Ensure all headings have scroll-margin-top for proper scrolling
    headings.forEach(h => {
        if (!h.style.scrollMarginTop) {
            h.style.scrollMarginTop = '120px';
        }
    });

    // STEP 5: Remove any previously inserted TOC (requested to disable TOC)
    const existingToc = container.querySelector('.toc-nav');
    if (existingToc) existingToc.remove();

    // Link inline TOC items to the enforced anchors for two sections requested
    if (!container.dataset.hbEnhanceClickBound) {
        container.dataset.hbEnhanceClickBound = '1';
        container.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (!a) return;
            const txt = (a.textContent || '').trim().toLowerCase();
            let targetId = null;
            if (txt.includes('screening framework')) targetId = 'screening-framework';
            if (txt.includes('target talent pools')) targetId = 'target-talent-pools';
            if (!targetId) return;
            const target = document.getElementById(targetId);
            if (target) {
                e.preventDefault();
                const det = target.closest('details');
                if (det) det.open = true;
                const y = target.getBoundingClientRect().top + window.pageYOffset - 120;
                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                if (history.replaceState) history.replaceState(null, '', `#${targetId}`);
            }
        });
    }

    // Remove duplicate "Introduction:" sections (keep only the first proper heading)
    // First, find the first proper "Introduction" heading
    const allNodes = Array.from(container.children);
    let firstIntroHeadingIndex = -1;
    
    allNodes.forEach((node, index) => {
        const text = (node.textContent || '').trim();
        const isProperIntroHeading = node.tagName && /^h[1-6]$/i.test(node.tagName) && /^Introduction\s*:?\s*$/i.test(text);
        if (isProperIntroHeading && firstIntroHeadingIndex === -1) {
            firstIntroHeadingIndex = index;
        }
    });
    
    // Collect nodes to remove (to avoid index issues during removal)
    const nodesToRemove = [];
    
    // Now find any paragraphs/strong/bold that start with "Introduction" and appear before the proper heading
    allNodes.forEach((node, index) => {
        if (firstIntroHeadingIndex === -1 || index >= firstIntroHeadingIndex) {
            return; // Skip if no proper heading found or we're at/after the proper heading
        }
        
        const text = (node.textContent || '').trim();
        
        // Check if this node starts with "Introduction" (various formats)
        const startsWithIntro = /^Introduction\s*:?\s*/i.test(text);
        
        // Check if it's a paragraph that starts with "Introduction" followed by text
        const isIntroParagraph = node.tagName === 'P' && startsWithIntro && text.length > 15;
        
        // Check if it's a standalone "Introduction" element
        const isStandaloneIntro = /^Introduction\s*:?\s*$/i.test(text) && 
                                   (node.tagName === 'P' || node.tagName === 'STRONG' || node.tagName === 'B');
        
        // Check if paragraph has "Introduction" in a strong/bold tag at the start
        const firstChild = node.querySelector && node.querySelector('strong:first-child, b:first-child');
        const hasIntroInBold = node.tagName === 'P' && firstChild && 
                               /^Introduction\s*:?\s*/i.test((firstChild.textContent || '').trim());
        
        if (isIntroParagraph || isStandaloneIntro || hasIntroInBold) {
            nodesToRemove.push(node);
        }
    });
    
    // Remove collected nodes
    nodesToRemove.forEach(node => node.remove());
    
    // Remove duplicate inline TOC blocks at the very top (pipe-separated or many anchors)
    const topNodes = Array.from(container.children).slice(0, 8);
    topNodes.forEach(node => {
        const text = (node.textContent || '').trim();
        const manyPipes = (text.match(/\|/g) || []).length >= 3; // e.g., "Intro | 1. JD Analysis | 2. ..."
        const manyLinks = (node.querySelectorAll && node.querySelectorAll('a').length) >= 5; // list of numbered links
        if (manyPipes || manyLinks) {
            node.remove();
        }
    });

    // Convert JD Snapshot bullets to summary tiles (first UL after a heading containing 'JD Snapshot')
    const snapshotHeading = Array.from(container.querySelectorAll('h2, h3')).find(h => /jd snapshot/i.test(h.textContent) || /quick summary/i.test(h.textContent) || /key role themes/i.test(h.textContent));
    if (snapshotHeading) {
        let ul = snapshotHeading.nextElementSibling;
        // Skip non-list siblings
        while (ul && ul.tagName && ul.tagName.toLowerCase() !== 'ul' && ul.tagName.toLowerCase() !== 'ol') { 
            ul = ul.nextElementSibling; 
        }
        if (ul && (ul.tagName.toLowerCase() === 'ul' || ul.tagName.toLowerCase() === 'ol')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'summary-tiles mt-2 mb-4';
            const items = Array.from(ul.querySelectorAll(':scope > li'));
            items.forEach(li => {
                const card = document.createElement('div');
                card.className = 'summary-tile';
                const body = document.createElement('div');
                body.className = 'summary-tile-body';
                
                // Parse the list item text - split by colon
                const text = li.textContent.trim();
                const colonIndex = text.indexOf(':');
                if (colonIndex > 0) {
                    const label = text.substring(0, colonIndex).trim();
                    const value = text.substring(colonIndex + 1).trim();
                    body.innerHTML = `<div class="fw-semibold mb-2 text-primary">${label}</div><div class="text-muted small">${value}</div>`;
                } else {
                    body.innerHTML = `<div class="text-muted">${text}</div>`;
                }
                
                card.appendChild(body);
                wrapper.appendChild(card);
            });
            ul.replaceWith(wrapper);
        }
    }
}

// Add copy buttons to Boolean search samples (delegates to pluto-handbook-result when available)
function addCopyButtonsToBooleanSamples() {
    const handbookContent = document.getElementById('handbook-content');
    if (!handbookContent) return;

    if (typeof window.refreshHandbookCopyButtons === 'function') {
        window.refreshHandbookCopyButtons();
        return;
    }

    if (handbookContent.querySelector('.hb-boolean-sample, .hb-platform-sourcing-group')) return;

    // Find all code blocks that contain Boolean samples
    const codeElements = handbookContent.querySelectorAll('code');
    
    codeElements.forEach(code => {
        const text = code.textContent;
        
        // Check if it looks like a Boolean search (contains AND/OR and parentheses)
        if ((text.includes('AND') || text.includes('OR')) && text.includes('(') && text.length > 20 && text.length < 250) {
            // Wrap code in a container with copy button
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            wrapper.style.width = '100%';
            wrapper.style.marginBottom = '10px';
            
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn btn-sm btn-outline-primary handbook-copy-btn';
            copyBtn.style.marginLeft = '10px';
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            copyBtn.dataset.copyText = text;
            
            // Insert wrapper before code element
            code.parentNode.insertBefore(wrapper, code);
            wrapper.appendChild(code);
            wrapper.appendChild(copyBtn);
        }
    });

    // Fallback: also detect boolean strings inside list items without backticks
    const listItems = handbookContent.querySelectorAll('li');
    listItems.forEach(li => {
        // If we already inserted a copy button here, skip
        if (li.querySelector('button.btn-outline-primary')) return;

        const text = li.textContent.trim();
        const match = text.match(/\[(.*?)\]/); // content inside []
        const candidate = match ? match[1] : text;
        if ((candidate.includes('AND') || candidate.includes('OR')) && candidate.includes('(') && candidate.length > 20 && candidate.length < 250) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-sm btn-outline-primary ms-2 handbook-copy-btn';
            copyBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            copyBtn.dataset.copyText = candidate;
            li.appendChild(copyBtn);
        }
    });
}

function buildHandbookIntelligenceWorkspace() {
    const container = document.getElementById('handbook-content');
    if (!container) return;

    const children = Array.from(container.children);
    if (children.length < 4) return;

    const sections = [];
    const introNodes = [];
    let active = null;
    let extractedTitle = '';
    let extractedMeta = '';
    children.forEach((node) => {
        const tag = (node.tagName || '').toUpperCase();
        if (!extractedTitle && tag === 'H1') {
            extractedTitle = (node.textContent || '').trim();
            return;
        }
        if (extractedTitle && !extractedMeta && tag === 'P') {
            const t = (node.textContent || '').trim();
            if (t && t.length < 180) extractedMeta = t;
        }
        const isHeading = tag === 'H2' || tag === 'H3';
        if (isHeading) {
            if (active) sections.push(active);
            active = { heading: node, nodes: [] };
            return;
        }
        if (active) active.nodes.push(node);
        else introNodes.push(node);
    });
    if (active) sections.push(active);
    if (sections.length === 0) return;

    const isTargetTalentPoolsSectionTitle = (title) => {
        const t = (title || '').toLowerCase();
        return (/target talent pools|talent pools/.test(t) || /\bsourcing\b/.test(t)) && !/primary\s+sourcing/.test(t);
    };

    const mergeStandaloneBooleanIntoTalentPools = (secs) => {
        const poolIdx = secs.findIndex((s) => isTargetTalentPoolsSectionTitle((s.heading.textContent || '').trim()));
        if (poolIdx === -1) return secs;
        const pool = secs[poolIdx];
        const out = [];
        secs.forEach((sec, i) => {
            const ht = (sec.heading.textContent || '').trim().replace(/^\d+\.?\s*/, '');
            const tl = ht.toLowerCase();
            const isStandaloneBoolean =
                /\bboolean\b/.test(tl) && !isTargetTalentPoolsSectionTitle(ht) && !/primary\s+sourcing/.test(tl);
            if (isStandaloneBoolean) {
                const block = [sec.heading, ...sec.nodes];
                if (i < poolIdx) pool.nodes.unshift(...block);
                else pool.nodes.push(...block);
                return;
            }
            out.push(sec);
        });
        return out;
    };

    const mergeTalentPoolSubsectionsIntoParent = (secs) => {
        const poolParentTitle = (raw) => {
            const title = (raw || '').trim().replace(/^\d+\.?\s*/, '');
            const t = title.toLowerCase();
            return (/target talent pools|talent pools/.test(t) || (/\bsourcing\b/.test(t) && !/primary\s+sourcing/.test(t)));
        };
        const poolSubHeading = (raw) => {
            const title = (raw || '').trim().replace(/^\d+\.?\s*/, '').replace(/\*\*/g, '').trim();
            const t = title.toLowerCase();
            if (/^likely companies\b/.test(t)) return true;
            if (/^likely titles\b/.test(t)) return true;
            if (/linkedin\s+x[-\s]?ray|google.*linkedin|x[-\s]?ray.*linkedin/i.test(t)) return true;
            if (/github\s+(user\s+)?search|github\s+profile\s+search/i.test(t)) return true;
            if (/^adjacent\s+skills\b|skill\s+adjacencies|alternative\s+skills/i.test(t)) return true;
            if (/platform[-\s]specific\s+sourcing/i.test(t)) return true;
            if (/boolean\s+(?:search\s+)?(?:samples?|keywords?)\b/.test(t)) return true;
            if (/^boolean keywords\b/.test(t)) return true;
            return false;
        };
        const merged = [];
        for (const sec of secs) {
            const h = (sec.heading.textContent || '').trim();
            if (merged.length && poolSubHeading(h)) {
                const prev = merged[merged.length - 1];
                if (poolParentTitle(prev.heading.textContent || '')) {
                    prev.nodes.push(sec.heading, ...sec.nodes);
                    continue;
                }
            }
            merged.push(sec);
        }
        return merged;
    };

    const mergedSections = mergeStandaloneBooleanIntoTalentPools(mergeTalentPoolSubsectionsIntoParent(sections));

    const tilesWrap = document.createElement('div');
    tilesWrap.className = 'ce-tiles-wrap ce-handbook-dashboard';

    const classifySection = (rawTitle) => {
        const title = (rawTitle || '').trim().replace(/^\d+\.?\s*/, '');
        const t = title.toLowerCase();
        if (/^job summary\b|\bjob summary\b/i.test(t)) {
            return { sortKey: 0, priority: 'high', moduleClass: 'ce-job-summary-module' };
        }
        if (/primary\s+sourcing|must-have\s*parameters|\(must-have\)/i.test(t)) {
            return { sortKey: 1, priority: 'high', moduleClass: '' };
        }
        if (/screening framework/.test(t)) return { sortKey: 10, priority: 'high', moduleClass: 'ce-screening-module' };
        if (/\bboolean\b/.test(t)) return { sortKey: 11, priority: 'high', moduleClass: 'ce-boolean-module' };
        if ((/target talent pools|talent pools/.test(t) || /\bsourcing\b/.test(t)) && !/primary\s+sourcing/.test(t)) {
            return { sortKey: 12, priority: 'high', moduleClass: 'ce-talent-module' };
        }
        if (/red flags|risk/.test(t)) return { sortKey: 13, priority: 'high', moduleClass: 'ce-redflags-module' };
        if (/recruiter\s+checklist|checklist\s*\(?\s*pre[-\s]?call\)?/i.test(t)) {
            return { sortKey: 22, priority: 'medium', moduleClass: '' };
        }
        if (/recruiter\s+sales\s+pitch|sales\s+pitch\s*\(?\s*to\s+candidates\)?/i.test(t)) {
            return { sortKey: 23, priority: 'medium', moduleClass: '' };
        }
        if (/overqualification|overkill\s+risk/i.test(t)) {
            return { sortKey: 24, priority: 'medium', moduleClass: '' };
        }
        if (/interview|questions|signals|checklist/.test(t)) return { sortKey: 20, priority: 'medium', moduleClass: '' };
        return { sortKey: 30, priority: 'low', moduleClass: '' };
    };

    const buildDashboardSummaryBullets = (root, sectionTitle) => {
        const out = [];
        const seen = new Set();
        const push = (raw) => {
            let t = (raw || '').replace(/\s+/g, ' ').trim();
            if (!t || t.length < 14) return;
            if (t.length > 170) t = `${t.slice(0, 167)}…`;
            const sec = (sectionTitle || '').toLowerCase();
            const isTalentPoolsSec =
                (/target talent pools|talent pools/.test(sec) || /\bsourcing\b/.test(sec)) && !/primary\s+sourcing/.test(sec);
            if (isTalentPoolsSec) {
                if (/\bAND\b|\bOR\b/.test(t) && /\(/.test(t) && t.length < 360) return;
                if (/site:\s*linkedin|github\.com\/search|site:\s*github/i.test(t)) return;
            }
            const k = t.toLowerCase();
            if (seen.has(k)) return;
            seen.add(k);
            out.push(t);
        };

        if (!root) return ['Expand this card for the full recruiter playbook.', 'Signals and copy are tuned to this JD.', 'Use actions (copy, checkboxes) as you work candidates.'];

        const secLower = (sectionTitle || '').toLowerCase();
        const skipLiForScan = /screening framework/.test(secLower);

        root.querySelectorAll('li').forEach((li) => {
            if (out.length >= 3) return;
            if (skipLiForScan) return;
            if (li.closest('.ce-boolean-list')) return;
            if (li.closest('.ce-handbook-checklist')) return;
            const t = (li.textContent || '').trim();
            if (t.length > 18) push(t);
        });

        if (out.length < 3 && root.querySelector('table')) {
            root.querySelectorAll('tbody tr').forEach((tr) => {
                if (out.length >= 3) return;
                const cell = tr.querySelector('td');
                if (cell) push(cell.textContent);
            });
        }

        if (out.length < 3 && /red flags|risk/.test(secLower)) {
            root.querySelectorAll('.ce-redflag-text').forEach((el) => {
                if (out.length >= 3) return;
                push(el.textContent);
            });
        }

        if (out.length < 3 && isTargetTalentPoolsSectionTitle(sectionTitle || '')) {
            root.querySelectorAll('.ce-sourcing-name').forEach((el) => {
                if (out.length >= 3) return;
                push(el.textContent);
            });
        }

        if (out.length < 3) {
            root.querySelectorAll('p').forEach((p) => {
                if (out.length >= 3) return;
                const t = (p.textContent || '').trim();
                if (t.length < 40) return;
                const parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 20);
                parts.forEach((part) => {
                    if (out.length >= 3) return;
                    push(part);
                });
            });
        }

        const label = (sectionTitle || 'this section').replace(/^\d+\.?\s*/, '').trim() || 'this section';
        while (out.length < 3) {
            if (out.length === 0) push(`Key signals for ${label} — expand for the full breakdown.`);
            else if (out.length === 1) push('Use the detailed view for evidence, probes, and recruiter-ready language.');
            else push('Actionable controls (copy, checklists) appear in the expanded panel.');
        }
        return out.slice(0, 3);
    };

    const renderDashboardCardSummary = (summaryEl, titleText, bullets) => {
        summaryEl.className = 'ce-dashboard-card-summary';
        summaryEl.innerHTML = '';
        const head = document.createElement('div');
        head.className = 'ce-tile-title';
        head.innerHTML = `<span>${escapeHtml(titleText || 'Section')}</span><span class="ce-tile-chevron">&gt;</span>`;
        const kicker = document.createElement('div');
        kicker.className = 'ce-dashboard-ai-kicker';
        kicker.textContent = 'AI summary — expand for full analysis';
        const ul = document.createElement('ul');
        ul.className = 'ce-dashboard-ai-bullets';
        (bullets || []).slice(0, 3).forEach((b) => {
            const li = document.createElement('li');
            li.textContent = b;
            ul.appendChild(li);
        });
        summaryEl.appendChild(head);
        summaryEl.appendChild(kicker);
        summaryEl.appendChild(ul);
        return ul;
    };

    const enrichScreeningTile = (tileBody, title) => {
        const note = document.createElement('div');
        note.className = 'ce-guidance-note';
        note.innerHTML = `<i class="bi bi-lightbulb"></i><span><strong>Recruiter cue:</strong> Lead with intent and depth-probe follow-ups while keeping technical evidence specific.</span>`;
        tileBody.prepend(note);

        const lists = tileBody.querySelectorAll('ul, ol');
        lists.forEach((list) => {
            list.classList.add('ce-question-list');
            Array.from(list.children).forEach((li) => li.classList.add('ce-question-item'));
        });
        tileBody.querySelectorAll('.ce-question-list > li.ce-question-item').forEach((li) => {
            if (li.querySelector('.ce-screening-used-row')) return;
            li.classList.add('ce-question-item--dashboard');
            const row = document.createElement('label');
            row.className = 'ce-screening-used-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'form-check-input ce-screening-used-cb';
            cb.setAttribute('aria-label', 'Mark as used after you ask this in a screen');
            const span = document.createElement('span');
            span.className = 'ce-screening-question-content';
            while (li.firstChild) {
                span.appendChild(li.firstChild);
            }
            row.appendChild(cb);
            row.appendChild(span);
            li.appendChild(row);
        });

        const groupHeads = Array.from(tileBody.querySelectorAll('h3, h4')).filter((h) => h.parentElement === tileBody);
        groupHeads.forEach((h) => {
            const next = h.nextElementSibling;
            if (!next || !/^UL$|^OL$/i.test(next.tagName || '')) return;
            const det = document.createElement('details');
            det.className = 'ce-screening-group';
            det.open = false;
            const sum = document.createElement('summary');
            sum.className = 'ce-screening-group-summary';
            sum.textContent = (h.textContent || '').replace(/\s+/g, ' ').trim();
            const body = document.createElement('div');
            body.className = 'ce-screening-group-body';
            let n = next;
            while (n && /^UL$|^OL$/i.test(n.tagName || '')) {
                const move = n;
                n = n.nextElementSibling;
                body.appendChild(move);
            }
            det.appendChild(sum);
            det.appendChild(body);
            h.replaceWith(det);
        });
    };

    const enrichTalentPoolsTile = (tileBody) => {
        const normalize = (arr) => {
            const seen = new Set();
            return arr.filter(Boolean).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => {
                const k = x.toLowerCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        };

        const extractPlatformSourcingFromBody = () => {
            const out = { linkedinXRay: '', githubSearch: '', adjacentSkills: [] };
            let sec = null;
            const normTxt = (node) => (node.textContent || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
            const normOneLine = (s) => (s || '').replace(/\s+/g, ' ').trim();

            const takeCodeOrText = (node) => {
                if (!node) return '';
                const code = node.querySelector && node.querySelector(':scope code');
                if (code) return (code.textContent || '').trim();
                if ((node.tagName || '').toUpperCase() === 'PRE') return (node.textContent || '').trim();
                const tx = node.textContent || '';
                const tick = tx.match(/`([^`]+)`/);
                if (tick) return tick[1].trim();
                return tx.replace(/\s+/g, ' ').trim();
            };

            const isLikelyLinkedinQuery = (t) =>
                /site:\s*linkedin\.com|linkedin\.com\/in\/|linkedin\.com\/pub\/|inurl:\s*linkedin/i.test(t);
            const isLikelyGithubQuery = (t) =>
                /github\.com\/search\?|https:\/\/github\.com\/search|site:\s*github\.com|type=Users/i.test(t);

            const classifyHeading = (low) => {
                if (
                    /^likely companies\b|^likely titles\b|boolean\s+(?:search\s+)?(?:samples?|keywords?)\b|^boolean keywords\b|red\s+flags\b|recruiter\s+sales|screening\s+framework|overqualification|recruiter\s+checklist/i.test(
                        low
                    )
                ) {
                    return 'clear';
                }
                if (/platform[-\s]specific\s+sourcing/i.test(low)) return 'clear';
                if (
                    /linkedin\s+x[-\s]?ray|x[-\s]?ray[^\n]{0,80}linkedin|linkedin[^\n]{0,60}x[-\s]?ray|google[^\n]{0,40}linkedin|site:\s*linkedin\.com\/in/i.test(
                        low
                    )
                ) {
                    return 'linkedin';
                }
                if (/github\s+(?:user\s+)?search|github[^\n]{0,30}(?:search|discovery)|repository\s+search/i.test(low)) {
                    return 'github';
                }
                if (
                    /\badjacent\s+skills?\b|\bskill\s+adjacencies\b|\balternative\s+skills\b|\bsubstitute\s+skills\b|\bpeer\s+(?:stack|framework|skills)\b|\bwiden(?:ing)?\s+the\s+(?:talent\s+)?pool/i.test(
                        low
                    )
                ) {
                    return 'adjacent';
                }
                return null;
            };

            const walkNodes = Array.from(
                tileBody.querySelectorAll('h1, h2, h3, h4, h5, h6, p, pre, ul, ol, blockquote, table tr')
            );

            walkNodes.forEach((node) => {
                const tag = (node.tagName || '').toUpperCase();
                const raw = normTxt(node);
                const low = raw.toLowerCase();

                if (/^H[1-6]$/.test(tag) || tag === 'P' || tag === 'BLOCKQUOTE') {
                    const h = classifyHeading(low);
                    if (h === 'clear') {
                        sec = null;
                        return;
                    }
                    if (h === 'linkedin' || h === 'github' || h === 'adjacent') {
                        sec = h;
                        return;
                    }
                }

                if (!sec) return;

                if (sec === 'linkedin') {
                    if (['PRE', 'P', 'BLOCKQUOTE', 'TR', 'LI'].includes(tag)) {
                        const t = normOneLine(takeCodeOrText(node));
                        if (t && !out.linkedinXRay) {
                            if (isLikelyLinkedinQuery(t) && t.length > 12) out.linkedinXRay = t;
                            else if (tag === 'PRE' && t.length > 20) out.linkedinXRay = t;
                        }
                    } else if (tag === 'UL' || tag === 'OL') {
                        node.querySelectorAll(':scope > li').forEach((li) => {
                            if (out.linkedinXRay) return;
                            const t = normOneLine(li.textContent || '');
                            if (t && isLikelyLinkedinQuery(t)) out.linkedinXRay = t;
                        });
                    }
                    return;
                }

                if (sec === 'github') {
                    if (['PRE', 'P', 'BLOCKQUOTE', 'TR', 'LI'].includes(tag)) {
                        const t = normOneLine(takeCodeOrText(node));
                        if (t && !out.githubSearch) {
                            if (isLikelyGithubQuery(t) && t.length > 12) out.githubSearch = t;
                            else if (tag === 'PRE' && t.length > 15) out.githubSearch = t;
                        }
                    } else if (tag === 'UL' || tag === 'OL') {
                        node.querySelectorAll(':scope > li').forEach((li) => {
                            if (out.githubSearch) return;
                            const t = normOneLine(li.textContent || '');
                            if (t && isLikelyGithubQuery(t)) out.githubSearch = t;
                        });
                    }
                    return;
                }

                if (sec === 'adjacent') {
                    if (tag === 'UL' || tag === 'OL') {
                        node.querySelectorAll(':scope > li').forEach((li) => {
                            if (out.adjacentSkills.length >= 3) return;
                            const s = normOneLine(li.textContent || '');
                            if (s) out.adjacentSkills.push(s);
                        });
                    } else if (tag === 'LI' && out.adjacentSkills.length < 3) {
                        const s = normOneLine(node.textContent || '');
                        if (s) out.adjacentSkills.push(s);
                    } else if (tag === 'P' && out.adjacentSkills.length < 3) {
                        const lines = (node.textContent || '')
                            .split(/\n+/)
                            .map((l) => l.trim())
                            .filter(Boolean);
                        lines.forEach((line) => {
                            if (out.adjacentSkills.length >= 3) return;
                            const s = normOneLine(line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''));
                            if (
                                s &&
                                s.length > 2 &&
                                s.length < 220 &&
                                !isLikelyLinkedinQuery(s) &&
                                !isLikelyGithubQuery(s)
                            ) {
                                out.adjacentSkills.push(s);
                            }
                        });
                    }
                }
            });

            const fullText = (tileBody.innerText || '').replace(/\r\n/g, '\n');
            if (!out.linkedinXRay) {
                const m =
                    fullText.match(
                        /site:\s*linkedin\.com(?:\/in|\/pub)?[^\n]{5,800}|https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)\]"']{3,200}/i
                    ) || fullText.match(/linkedin\.com\/in\/[^\s)\]"']{3,200}/i);
                if (m) out.linkedinXRay = normOneLine(m[0]).slice(0, 900);
            }
            if (!out.githubSearch) {
                const m =
                    fullText.match(/https:\/\/github\.com\/search[^\s\n]{8,1200}/i) ||
                    fullText.match(/site:\s*github\.com[^\n]{8,800}/i);
                if (m) out.githubSearch = normOneLine(m[0]).slice(0, 1200);
            }
            if (!out.adjacentSkills.length) {
                const marker = /adjacent\s+skills?|skill\s+adjacencies|alternative\s+skills/i.exec(fullText);
                if (marker) {
                    const slice = fullText.slice(marker.index, marker.index + 1400);
                    const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
                    lines.forEach((line) => {
                        if (out.adjacentSkills.length >= 3) return;
                        const bullet = line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
                        if (
                            bullet.length > 3 &&
                            bullet.length < 220 &&
                            !/^adjacent\s+skills?$/i.test(bullet) &&
                            !/^platform[-\s]specific/i.test(bullet) &&
                            !isLikelyLinkedinQuery(bullet) &&
                            !isLikelyGithubQuery(bullet) &&
                            !/^(linkedin|github)\s+x[-\s]?ray|github\s+(user\s+)?search/i.test(bullet)
                        ) {
                            out.adjacentSkills.push(bullet);
                        }
                    });
                }
            }

            out.adjacentSkills = normalize(out.adjacentSkills).slice(0, 3);
            return out;
        };

        const buildPlatformSourcingTabsUI = (ps) => {
            const wrap = document.createElement('div');
            wrap.className = 'ce-platform-sourcing';
            const liText = (ps.linkedinXRay || '').trim() || 'No LinkedIn X-Ray string was found in this handbook. Regenerate or paste a site:linkedin.com/in query manually.';
            const ghText = (ps.githubSearch || '').trim() || 'No GitHub search line was found. Add a github.com/search URL or a site:github.com Google query.';
            const skills = (ps.adjacentSkills || []).slice(0, 3);
            const adjDisplay = skills.length ? skills.map((s) => `- ${s}`).join('\n') : 'No adjacent skills were parsed from the JD block.';

            const header = document.createElement('div');
            header.className = 'ce-sourcing-cluster ce-platform-sourcing-cluster';
            header.innerHTML = `
                <div class="ce-sourcing-cluster-title">Platform-specific sourcing</div>
                <div class="ce-sourcing-rationale">Google X-Ray for LinkedIn, GitHub discovery, and skill adjacency to widen the pool—copy as-is.</div>
            `;
            wrap.appendChild(header);

            const tablist = document.createElement('div');
            tablist.className = 'ce-platform-tablist';
            tablist.setAttribute('role', 'tablist');
            [['linkedin', 'LinkedIn X-Ray'], ['github', 'GitHub'], ['adjacent', 'Adjacent Skills']].forEach(([id, label], i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `ce-platform-tab${i === 0 ? ' is-active' : ''}`;
                b.setAttribute('role', 'tab');
                b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
                b.setAttribute('data-ce-tab', id);
                b.textContent = label;
                tablist.appendChild(b);
            });
            wrap.appendChild(tablist);

            const panels = document.createElement('div');
            panels.className = 'ce-platform-panels';

            const makePanel = (id, codeText) => {
                const panel = document.createElement('div');
                panel.className = `ce-platform-panel${id === 'linkedin' ? ' is-active' : ''}`;
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('data-ce-panel', id);
                const pre = document.createElement('pre');
                pre.className = 'ce-platform-code';
                const code = document.createElement('code');
                code.className = 'ce-platform-code-inner';
                code.textContent = codeText;
                pre.appendChild(code);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-primary ce-boolean-copy-btn ce-platform-copy';
                btn.innerHTML = '<i class="bi bi-clipboard-check me-2"></i>Copy to Clipboard';
                btn.addEventListener('click', () => {
                    copyToClipboard(codeText, btn);
                });
                panel.appendChild(pre);
                panel.appendChild(btn);
                panels.appendChild(panel);
            };

            makePanel('linkedin', liText);
            makePanel('github', ghText);
            makePanel('adjacent', adjDisplay);
            wrap.appendChild(panels);

            tablist.querySelectorAll('.ce-platform-tab').forEach((tab) => {
                tab.addEventListener('click', () => {
                    const id = tab.getAttribute('data-ce-tab');
                    tablist.querySelectorAll('.ce-platform-tab').forEach((t) => {
                        t.classList.remove('is-active');
                        t.setAttribute('aria-selected', 'false');
                    });
                    panels.querySelectorAll('.ce-platform-panel').forEach((p) => p.classList.remove('is-active'));
                    tab.classList.add('is-active');
                    tab.setAttribute('aria-selected', 'true');
                    const pan = panels.querySelector(`[data-ce-panel="${id}"]`);
                    if (pan) pan.classList.add('is-active');
                });
            });

            return wrap;
        };

        const platformSourcing = extractPlatformSourcingFromBody();

        const extractBooleanSamplesFromBody = () => {
            const children = Array.from(tileBody.children);
            let collecting = false;
            const raw = [];
            const booleanHeading = /boolean\s+(?:search\s+)?(?:samples?|keywords?)\b/i;
            const stopHeading =
                /^(?:\*\*\s*)?(?:\d+\.\s*)?(?:Likely Companies|Likely Titles|LinkedIn|GitHub|Adjacent|Platform-Specific|Boolean|Red Flags|Recruiter Sales|Recruiter Checklist|Overqualification|Screening Framework)/i;
            const normalizeLine = (s) => s.replace(/\s+/g, ' ').trim();
            const parseBooleanLine = (line) => {
                let t = normalizeLine(line);
                if (!t || booleanHeading.test(t)) return '';
                t = t.replace(/^\*+\s*/, '');
                t = t.replace(/^\*?\*?\s*Sample\s*\d[^:]*:?\s*\*?\*?\s*/i, '');
                t = t.replace(/^Sample\s*\d[^:]*:\s*/i, '');
                const tick = t.match(/`([^`]+)`/);
                if (tick) t = normalizeLine(tick[1]);
                t = t.replace(/^\[[^\]]+\]\s*/, '');
                return normalizeLine(t);
            };
            children.forEach((node) => {
                const tag = (node.tagName || '').toUpperCase();
                const text = (node.textContent || '').trim();
                if (/^H2$|^H3$|^H4$|^STRONG$|^P$/.test(tag)) {
                    if (booleanHeading.test(text)) {
                        collecting = true;
                        return;
                    }
                    if (collecting && stopHeading.test(text) && !booleanHeading.test(text)) {
                        collecting = false;
                        return;
                    }
                }
                if (!collecting) return;
                if (tag === 'PRE') {
                    const p = parseBooleanLine(node.textContent || '');
                    if (p && /\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search/i.test(p)) raw.push(p);
                    return;
                }
                if (tag === 'UL' || tag === 'OL') {
                    node.querySelectorAll(':scope > li').forEach((li) => {
                        const p = parseBooleanLine(li.textContent || '');
                        if (p && /\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search/i.test(p)) raw.push(p);
                    });
                    return;
                }
                if (tag === 'LI') {
                    const p = parseBooleanLine(text);
                    if (p && /\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search/i.test(p)) raw.push(p);
                    return;
                }
                if (tag === 'P' && text) {
                    const p = parseBooleanLine(text);
                    if (p && /\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search/i.test(p)) raw.push(p);
                }
            });
            return normalize(raw).filter((t) => /\(|\)|\bAND\b|\bOR\b|site:|github\.com\/search/i.test(t)).slice(0, 3);
        };

        const booleanSamples = extractBooleanSamplesFromBody();

        const getItemsAfterHeading = (headingRegexes) => {
            const children = Array.from(tileBody.children);
            let collecting = false;
            const out = [];
            children.forEach((node) => {
                const tag = (node.tagName || '').toUpperCase();
                const text = (node.textContent || '').trim();
                if (/^H2$|^H3$|^H4$|^STRONG$|^P$/.test(tag)) {
                    const isStart = headingRegexes.some((re) => re.test(text));
                    const isStop =
                        /likely companies|likely titles|linkedin\s+x|github\s+(user\s+)?search|adjacent\s+skills|platform[-\s]specific|boolean search|boolean keywords|sample\s*\d|red flags|recruiter sales pitch|checklist/i.test(
                            text
                        );
                    if (isStart) {
                        collecting = true;
                        return;
                    }
                    if (collecting && isStop) {
                        collecting = false;
                    }
                }
                if (!collecting) return;
                if (tag === 'UL' || tag === 'OL') {
                    out.push(...Array.from(node.querySelectorAll('li')).map((li) => (li.textContent || '').trim()).filter(Boolean));
                } else if (tag === 'LI') {
                    out.push(text);
                } else if (tag === 'P' && text && !/^\d+\.?\s*/.test(text)) {
                    if (!/sample\s*\d|boolean/i.test(text)) out.push(text);
                }
            });
            return out;
        };

        const companies = normalize(getItemsAfterHeading([/likely companies/i]));
        const titles = normalize(getItemsAfterHeading([/likely titles/i]));

        const allCandidates = [...companies, ...titles];

        const groups = {
            'Primary Sourcing Companies': {
                rationale: 'Strongest-fit organizations to anchor your first outbound and search passes.',
                items: []
            },
            'Secondary Sourcing Companies': {
                rationale: 'Adjacent employers where similar skills and seniority often show up.',
                items: []
            },
            'Ideal Job Titles': {
                rationale: 'Title strings and variants to pair with company filters in Boolean and LinkedIn search.',
                items: []
            }
        };

        allCandidates.forEach((item) => {
            const t = item.toLowerCase();
            if (/java|backend|platform|infra|distributed|architect|spring|cloud/i.test(t)) {
                groups['Primary Sourcing Companies'].items.push(item);
            } else if (/manager|lead|consult|service|product|startup|scale/i.test(t)) {
                groups['Secondary Sourcing Companies'].items.push(item);
            } else {
                groups['Ideal Job Titles'].items.push(item);
            }
        });

        tileBody.innerHTML = '';
        const frag = document.createDocumentFragment();
        Object.entries(groups).forEach(([label, cfg]) => {
            const items = normalize(cfg.items);
            if (!items.length) return;
            const cluster = document.createElement('div');
            cluster.className = 'ce-sourcing-cluster';
            cluster.innerHTML = `
                <div class="ce-sourcing-cluster-title">${label}</div>
                <div class="ce-sourcing-rationale">${cfg.rationale}</div>
            `;
            const listWrap = document.createElement('div');
            listWrap.className = 'ce-sourcing-list';
            items.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'ce-sourcing-item';
                row.innerHTML = `<span class="ce-sourcing-dot"></span><span class="ce-sourcing-name">${escapeHtml(item)}</span>`;
                listWrap.appendChild(row);
            });
            cluster.appendChild(listWrap);
            frag.appendChild(cluster);
        });
        if (frag.childNodes.length) {
            tileBody.appendChild(frag);
        }
        tileBody.appendChild(buildPlatformSourcingTabsUI(platformSourcing));

        if (booleanSamples.length) {
            const bCluster = document.createElement('div');
            bCluster.className = 'ce-sourcing-cluster ce-sourcing-cluster--boolean';
            const bt = document.createElement('div');
            bt.className = 'ce-sourcing-cluster-title';
            bt.textContent = 'Boolean search (ATS & engines)';
            const br = document.createElement('div');
            br.className = 'ce-sourcing-rationale';
            br.textContent =
                'Three copy-ready strings from the handbook—kept here only so sourcing stays in one workspace.';
            bCluster.appendChild(bt);
            bCluster.appendChild(br);
            const list = document.createElement('div');
            list.className = 'ce-boolean-list';
            booleanSamples.forEach((q, idx) => {
                const item = document.createElement('div');
                item.className = 'ce-boolean-item';
                item.innerHTML = `
                        <div class="ce-boolean-label">Sample ${idx + 1}</div>
                        <div class="ce-boolean-query">${escapeHtml(q)}</div>
                    `;
                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.className = 'btn btn-primary ce-boolean-copy-btn';
                copyBtn.innerHTML = '<i class="bi bi-clipboard-check me-2"></i>Copy to Clipboard';
                copyBtn.onclick = function () {
                    copyToClipboard(q, copyBtn);
                };
                item.appendChild(copyBtn);
                list.appendChild(item);
            });
            bCluster.appendChild(list);
            tileBody.appendChild(bCluster);
        }

        return { booleanSamples, platformSourcing };
    };

    const enrichRedFlagsTile = (tileBody) => {
        const listItems = Array.from(tileBody.querySelectorAll('li')).map((li) => (li.textContent || '').trim()).filter(Boolean);
        if (listItems.length === 0) return;

        const wrap = document.createElement('div');
        wrap.className = 'ce-redflags-list';
        listItems.forEach((item) => {
            const lower = item.toLowerCase();
            let severity = 'Moderate';
            if (/critical|must|non-negotiable|disqualify|disqualifier/.test(lower)) severity = 'High';
            else if (/watch|check|probe|verify|concern/.test(lower)) severity = 'Medium';
            else severity = 'Baseline';

            const row = document.createElement('div');
            row.className = 'ce-redflag-item';
            row.innerHTML = `
                <span class="ce-redflag-severity ce-redflag-${severity.toLowerCase()}">${severity}</span>
                <span class="ce-redflag-text">${escapeHtml(item)}</span>
            `;
            wrap.appendChild(row);
        });

        const cue = document.createElement('div');
        cue.className = 'ce-guidance-note ce-redflag-cue';
        cue.innerHTML = `<i class="bi bi-shield-exclamation"></i><span><strong>Recruiter caution:</strong> Validate these signals early in first-screen calls before moving candidates to panel rounds.</span>`;

        tileBody.innerHTML = '';
        tileBody.appendChild(cue);
        tileBody.appendChild(wrap);
    };

    const enrichRecruiterChecklistTile = (tileBody) => {
        const normalizeLine = (s) => s.replace(/\s+/g, ' ').trim();
        const stripBulletPrefix = (line) => {
            let s = normalizeLine(line);
            if (!s) return '';
            s = s.replace(/^\s*(?:[-*•]|\[[ xX]\])\s+/, '');
            s = s.replace(/^\s*\d+[.)]\s+/, '');
            return normalizeLine(s);
        };
        const looksLikeBulletLine = (line) => {
            const t = normalizeLine(line);
            if (!t) return false;
            return (
                /^[-*•]\s+/.test(t)
                || /^\d+[.)]\s+/.test(t)
                || /^\[[ xX]\]\s+/.test(t)
            );
        };

        const collected = [];
        const seen = new Set();
        const pushItem = (text) => {
            const t = normalizeLine(text);
            if (!t || t.length < 2) return;
            const k = t.toLowerCase();
            if (seen.has(k)) return;
            seen.add(k);
            collected.push(t);
        };

        tileBody.querySelectorAll('ul li, ol li').forEach((li) => {
            if (li.querySelector(':scope > label.ce-handbook-checklist-row')) return;
            const c = li.cloneNode(true);
            c.querySelectorAll('ul, ol').forEach((sub) => sub.remove());
            const t = normalizeLine(c.textContent || '');
            if (t) pushItem(t);
        });

        tileBody.querySelectorAll('p').forEach((p) => {
            const raw = (p.textContent || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
            if (raw.length === 0) return;
            if (raw.length === 1 && !looksLikeBulletLine(raw[0])) return;
            raw.forEach((line) => {
                if (!looksLikeBulletLine(line)) return;
                const stripped = stripBulletPrefix(line);
                if (stripped) pushItem(stripped);
            });
        });

        const buildChecklistUl = (items) => {
            const ul = document.createElement('ul');
            ul.className = 'ce-handbook-checklist';
            items.forEach((itemText) => {
                const li = document.createElement('li');
                li.className = 'ce-handbook-checklist-li';
                const label = document.createElement('label');
                label.className = 'ce-handbook-checklist-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = false;
                cb.className = 'ce-handbook-checklist-cb';
                cb.setAttribute('aria-label', 'Checklist item');
                const span = document.createElement('span');
                span.className = 'ce-handbook-checklist-text';
                span.textContent = itemText;
                label.appendChild(cb);
                label.appendChild(span);
                li.appendChild(label);
                ul.appendChild(li);
            });
            return ul;
        };

        if (collected.length > 0) {
            tileBody.innerHTML = '';
            tileBody.appendChild(buildChecklistUl(collected));
            return;
        }

        tileBody.querySelectorAll('ul, ol').forEach((list) => {
            list.classList.add('ce-handbook-checklist');
            Array.from(list.children).forEach((child) => {
                if (child.tagName !== 'LI' || child.querySelector(':scope > label.ce-handbook-checklist-row')) return;
                const label = document.createElement('label');
                label.className = 'ce-handbook-checklist-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = false;
                cb.className = 'ce-handbook-checklist-cb';
                cb.setAttribute('aria-label', 'Checklist item');
                const span = document.createElement('span');
                span.className = 'ce-handbook-checklist-text';
                while (child.firstChild) {
                    span.appendChild(child.firstChild);
                }
                label.appendChild(cb);
                label.appendChild(span);
                child.appendChild(label);
                child.classList.add('ce-handbook-checklist-li');
            });
        });
    };

    mergedSections.forEach((sec, idx) => { sec._handbookSectionOrder = idx; });
    mergedSections
        .sort((a, b) => {
            const ma = classifySection(a.heading.textContent || '');
            const mb = classifySection(b.heading.textContent || '');
            if (ma.sortKey !== mb.sortKey) return ma.sortKey - mb.sortKey;
            return (a._handbookSectionOrder || 0) - (b._handbookSectionOrder || 0);
        })
        .forEach((sec) => {
            const tile = document.createElement('details');
            const sectionMeta = classifySection(sec.heading.textContent || '');
            tile.className = `ce-tile ce-handbook-dashboard-card ce-priority-${sectionMeta.priority} ${sectionMeta.moduleClass}`.trim();
            const title = (sec.heading.textContent || '').trim().replace(/^\d+\.?\s*/, '');
            if (sec.heading && sec.heading.id) {
                tile.id = sec.heading.id;
            }
            tile.open = false;

            const summaryEl = document.createElement('summary');

            const body = document.createElement('div');
            body.className = 'ce-tile-body';
            sec.nodes.forEach((n) => body.appendChild(n));
            if (/screening framework/i.test(title)) enrichScreeningTile(body, title);
            if (isTargetTalentPoolsSectionTitle(title)) {
                enrichTalentPoolsTile(body);
            }
            if (/red flags|risk/i.test(title)) enrichRedFlagsTile(body);
            if (/recruiter\s+checklist/i.test(title)) enrichRecruiterChecklistTile(body);

            const bullets = buildDashboardSummaryBullets(body, title);
            renderDashboardCardSummary(summaryEl, title || 'Section', bullets);

            tile.appendChild(summaryEl);
            tile.appendChild(body);
            tilesWrap.appendChild(tile);
        });

    const hasExplicitJobSummary = mergedSections.some((sec) => /job summary/i.test((sec.heading.textContent || '').trim()));
    if (!hasExplicitJobSummary) {
        const titleText = (extractedTitle || (document.getElementById('handbook_job_title')?.value || 'This role')).trim();

        const summaryTile = document.createElement('details');
        summaryTile.className = 'ce-tile ce-handbook-dashboard-card ce-priority-high ce-job-summary-module';
        summaryTile.open = false;

        const summarySummary = document.createElement('summary');
        const summaryBody = document.createElement('div');
        summaryBody.className = 'ce-tile-body';
        const summaryIntro = document.createElement('div');
        summaryIntro.className = 'ce-guidance-note';
        summaryIntro.innerHTML = `<i class="bi bi-journal-text"></i><span><strong>Recruiter brief:</strong> Use this summary as your fast context before sourcing and screening.</span>`;
        const summaryText = document.createElement('p');
        summaryText.className = 'ce-job-summary-text';
        summaryText.textContent = currentHandbookSummary || 'Generating AI job summary...';

        summaryBody.appendChild(summaryIntro);
        summaryBody.appendChild(summaryText);

        const jobSummaryTitle = 'Job Summary';
        const initialJobBullets = buildDashboardSummaryBullets(summaryBody, jobSummaryTitle);
        const jobSummaryBulletList = renderDashboardCardSummary(summarySummary, jobSummaryTitle, initialJobBullets);

        const refreshJobSummaryBullets = () => {
            const next = [
                'Sourcing signals, companies, titles, platform X-Ray, and Boolean strings live in Target Talent Pools.',
                'Screening Framework holds category-grouped questions—use checkmarks as you run calls.',
                'When ready, export the PDF or continue to MatchMaker with the same Job ID and JD.'
            ];
            jobSummaryBulletList.innerHTML = '';
            next.forEach((b) => {
                const li = document.createElement('li');
                li.textContent = b;
                jobSummaryBulletList.appendChild(li);
            });
        };

        summaryTile.appendChild(summarySummary);
        summaryTile.appendChild(summaryBody);
        tilesWrap.prepend(summaryTile);
        if (currentHandbookSummary) {
            refreshJobSummaryBullets();
        }

        const requestPayload = {
            job_title: (currentHandbookData?.jobTitle || titleText || '').trim(),
            job_description: (currentHandbookData?.jobDescription || '').trim(),
            handbook_content: (currentHandbookContent || container.textContent || '').trim()
        };
        const summaryCacheKey = JSON.stringify(requestPayload);
        if (!summaryText.dataset.loading && !currentHandbookSummary) {
            summaryText.dataset.loading = '1';
            apiFetch('/api/generate-handbook-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload)
            })
                .then((r) => r.json())
                .then((res) => {
                    if (res && res.success && res.summary) {
                        currentHandbookSummary = res.summary;
                        summaryText.textContent = res.summary;
                        try { sessionStorage.setItem(`hbSummary:${summaryCacheKey}`, res.summary); } catch (_) {}
                        refreshJobSummaryBullets();
                    } else {
                        throw new Error((res && res.message) || 'Failed summary generation');
                    }
                })
                .catch(() => {
                    let cached = '';
                    try { cached = sessionStorage.getItem(`hbSummary:${summaryCacheKey}`) || ''; } catch (_) {}
                    summaryText.textContent = cached || `${titleText || 'This role'} requires focused sourcing and structured screening.`;
                    if (cached) currentHandbookSummary = cached;
                    refreshJobSummaryBullets();
                });
        } else if (!currentHandbookSummary) {
            try {
                const cached = sessionStorage.getItem(`hbSummary:${summaryCacheKey}`) || '';
                if (cached) {
                    currentHandbookSummary = cached;
                    summaryText.textContent = cached;
                    refreshJobSummaryBullets();
                }
            } catch (_) {}
        }
    }

    container.innerHTML = '';
    container.appendChild(tilesWrap);
    container.dataset.workspaceBuilt = '1';

    const metaEl = document.getElementById('handbook-job-meta-display');
    if (window.setHandbookResultHeader) {
        const fallbackTitle = extractedTitle || (document.getElementById('handbook_job_title')?.value || '').trim();
        window.setHandbookResultHeader(fallbackTitle);
    }
    if (metaEl) {
        metaEl.textContent = extractedMeta || '';
        metaEl.style.display = extractedMeta ? '' : 'none';
    }

    const fullText = (container.textContent || '').toLowerCase();
    const complexityHits = ['critical', 'must-have', 'mandatory', 'deep', 'architecture'].reduce((n, k) => n + (fullText.includes(k) ? 1 : 0), 0);
    const focus = fullText.includes('screening framework') ? 'Screening fidelity' : fullText.includes('talent pools') ? 'Sourcing precision' : 'Role alignment';
    const complexity = complexityHits >= 4 ? 'High' : complexityHits >= 2 ? 'Moderate' : 'Focused';

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('hb-cc-complexity', complexity);
    setText('hb-cc-focus', focus);
}

function renderPlutoInsightsFromHandbook() {
    const panel = document.getElementById('pluto-insights-panel');
    const container = document.getElementById('handbook-content');
    if (!panel || !container) return;

    const text = (container.textContent || '').toLowerCase();
    const countHits = (arr) => arr.reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);

    const difficultyScore = countHits(['must-have', 'critical', 'senior', 'deep', 'architecture', 'scal']);
    const leadershipScore = countHits(['lead', 'stakeholder', 'mentor', 'ownership', 'manager']);
    const passiveScore = countHits(['top companies', 'talent pools', 'passive', 'sourcing', 'niche']);
    const architectureScore = countHits(['microservices', 'distributed', 'system design', 'architecture', 'scalability']);
    const riskScore = countHits(['red flag', 'risk', 'overqualification', 'concern']);

    const setText = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    };

    setText('pluto-insight-difficulty', difficultyScore >= 5 ? 'High' : difficultyScore >= 3 ? 'Medium' : 'Low');
    setText('pluto-insight-leadership', leadershipScore >= 3 ? 'Strong' : leadershipScore >= 1 ? 'Moderate' : 'Limited');
    setText('pluto-insight-market', passiveScore >= 3 ? 'Likely passive candidates' : 'Mixed active/passive');
    setText('pluto-insight-architecture', architectureScore >= 3 ? 'High depth required' : 'Moderate depth');
    setText('pluto-insight-priority', riskScore >= 3 ? 'Red-flag screening first' : 'Screening framework first');
    setText('pluto-insight-complexity', (difficultyScore + riskScore) >= 7 ? 'Elevated' : 'Standard');
}

// Copy text to clipboard
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = button.innerHTML;
        const hadPrimary = button.classList.contains('btn-primary');
        const hadOutline = button.classList.contains('btn-outline-primary');
        button.innerHTML = '<i class="bi bi-check-lg me-2"></i>Copied!';
        button.classList.remove('btn-outline-primary', 'btn-primary');
        button.classList.add('btn-success');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('btn-success');
            if (hadPrimary) button.classList.add('btn-primary');
            else if (hadOutline) button.classList.add('btn-outline-primary');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    });
}

window.copyToClipboard = copyToClipboard;

// Render Candidate Fit Analysis tables and narrative
function renderCandidateFitAnalysis(fitAnalysis) {
    const fitAnalysisSection = document.getElementById('candidate-fit-analysis');
    
    if (!fitAnalysis || Object.keys(fitAnalysis).length === 0) {
        console.warn('No candidate fit analysis data provided - this is normal for older evaluations');
        // Hide the section for old evaluations that don't have this data
        if (fitAnalysisSection) {
            fitAnalysisSection.style.display = 'none';
        }
        return;
    }
    
    if (fitAnalysisSection) {
        fitAnalysisSection.style.display = 'block';
    }
    
    // Table 1: Dimension Evaluation
    const dimensionsBody = document.getElementById('fit-dimensions-body');
    if (fitAnalysis['Dimension Evaluation'] && fitAnalysis['Dimension Evaluation'].length > 0) {
        dimensionsBody.innerHTML = fitAnalysis['Dimension Evaluation'].map(dim => `
            <tr>
                <td><strong>${escapeHtml(dim.Dimension || '')}</strong></td>
                <td>${dim.Evaluation || ''}</td>
                <td>${escapeHtml(dim['Recruiter Comments'] || '')}</td>
            </tr>
        `).join('');
    } else {
        dimensionsBody.innerHTML = '<tr><td colspan="3" class="text-muted">No dimension evaluation available</td></tr>';
    }
    
    // Table 2: Risk & Gaps
    const risksBody = document.getElementById('fit-risks-body');
    const risksContainer = document.getElementById('fit-risks-container');
    if (fitAnalysis['Risk and Gaps'] && fitAnalysis['Risk and Gaps'].length > 0) {
        risksBody.innerHTML = fitAnalysis['Risk and Gaps'].map(risk => `
            <tr>
                <td><strong>${escapeHtml(risk.Area || '')}</strong></td>
                <td>${escapeHtml(risk.Risk || '')}</td>
                <td>${escapeHtml(risk['Recruiter Strategy'] || '')}</td>
            </tr>
        `).join('');
        risksContainer.style.display = 'block';
    } else {
        risksBody.innerHTML = '<tr><td colspan="3" class="text-success text-center"><strong>✓ No Major Risks Identified</strong></td></tr>';
        risksContainer.style.display = 'block';
    }
    
    // Table 3: Recruiter Recommendation
    const recommendationBody = document.getElementById('fit-recommendation-body');
    if (fitAnalysis['Recommendation']) {
        const rec = fitAnalysis['Recommendation'];
        recommendationBody.innerHTML = `
            <tr>
                <td><strong>${rec.Verdict || 'N/A'}</strong></td>
                <td class="text-center"><strong>${rec['Fit Level'] || 'N/A'}</strong></td>
                <td>${escapeHtml(rec.Rationale || 'No rationale provided')}</td>
            </tr>
        `;
    } else {
        recommendationBody.innerHTML = '<tr><td colspan="3" class="text-muted">No recommendation available</td></tr>';
    }
    
    // Recruiter Narrative
    const narrativeDiv = document.getElementById('recruiter-narrative');
    if (fitAnalysis['Recruiter Narrative']) {
        narrativeDiv.innerHTML = `<p class="mb-0"><em>${escapeHtml(fitAnalysis['Recruiter Narrative'])}</em></p>`;
    } else {
        narrativeDiv.innerHTML = '<p class="mb-0 text-muted">No recruiter narrative available</p>';
    }
}

// Helper function to escape HTML (prevent XSS)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function clearJdQualityScoreDock() {
    const dock = document.getElementById('jd-quality-score-dock');
    if (!dock) return;
    dock.innerHTML = '';
    dock.style.display = 'none';
}

/** Renders JD Quality & Ghost Role Scorer panel (call after /api/jd-quality-score success). */
function renderJdQualityScoreDock(payload) {
    const dock = document.getElementById('jd-quality-score-dock');
    if (!dock || !payload || !payload.success) return;
    const score = Math.max(0, Math.min(100, parseInt(payload.score, 10) || 0));
    const tier = score >= 85 ? 'jd-tier-strong' : score >= 70 ? 'jd-tier-ok' : 'jd-tier-risk';
    let html = `<div class="jd-quality-dock-inner ${tier}">`;
    html += '<div class="jd-quality-score-row">';
    html += '<span class="jd-quality-label">JD Quality Score</span>';
    html += `<span class="jd-quality-score-value" aria-label="Score ${score} out of 100">${score}</span><span class="jd-quality-score-max">/100</span>`;
    html += '</div>';
    if (payload.completeness_summary) {
        html += `<p class="jd-quality-micro mb-1"><strong>Clarity:</strong> ${escapeHtml(payload.completeness_summary)}</p>`;
    }
    if (payload.realism_summary) {
        html += `<p class="jd-quality-micro mb-1"><strong>Realism:</strong> ${escapeHtml(payload.realism_summary)}</p>`;
    }
    if (payload.bias_summary) {
        html += `<p class="jd-quality-micro mb-2"><strong>Bias check:</strong> ${escapeHtml(payload.bias_summary)}</p>`;
    }
    if (payload.show_warning && Array.isArray(payload.improvement_suggestions) && payload.improvement_suggestions.length) {
        html += '<div class="alert alert-warning jd-quality-alert mb-0" role="alert">';
        html += '<div class="fw-semibold mb-2"><i class="bi bi-exclamation-triangle-fill me-2"></i>Improve this JD before heavy sourcing (score under 70)</div>';
        html += '<ol class="mb-0 ps-3 jd-quality-suggestion-list">';
        payload.improvement_suggestions.slice(0, 3).forEach((s) => {
            html += `<li>${escapeHtml(String(s))}</li>`;
        });
        html += '</ol></div>';
    }
    html += '</div>';
    dock.innerHTML = html;
    dock.style.display = 'block';
}

// ============================================
// Context-Specific History Functions (DISABLED)
// These have been removed - use main /history page instead
// ============================================

/*
// Load Handbook History
function loadHandbookHistory() {
    console.log('loadHandbookHistory called');
    
    // FORCE the tab to show by manually adding Bootstrap classes
    const handbookHistoryPane = document.getElementById('handbook-history');
    const generateHandbookPane = document.getElementById('generate-handbook');
    
    if (handbookHistoryPane && generateHandbookPane) {
        // Remove active/show from generate handbook tab
        generateHandbookPane.classList.remove('show', 'active');
        // Add active/show to handbook history tab
        handbookHistoryPane.classList.add('show', 'active');
        console.log('Manually switched handbook tab panes');
    }
    
    const loadingDiv = document.getElementById('handbook-history-loading');
    const tableBody = document.getElementById('handbook-history-table-body');
    const noHandbooksMsg = document.getElementById('no-handbooks-message');
    
    if (!loadingDiv || !tableBody || !noHandbooksMsg) {
        console.error('Missing required handbook elements!');
        return;
    }
    
    loadingDiv.style.display = 'block';
    noHandbooksMsg.style.display = 'none';
    
    apiFetch('/api/handbooks-only')
        .then(response => response.json())
        .then(data => {
            loadingDiv.style.display = 'none';
            
            if (data.success && data.handbooks && data.handbooks.length > 0) {
                tableBody.innerHTML = '';
                data.handbooks.forEach(handbook => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>${escapeHtml(handbook.job_title)}</strong></td>
                        <td><span class="badge bg-secondary">${escapeHtml(handbook.oorwin_job_id || 'N/A')}</span></td>
                        <td>${new Date(handbook.timestamp).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="viewHandbookFromHistory(${handbook.id})">
                                <i class="bi bi-eye"></i> View
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
                
                // FORCE dimensions via JavaScript (Bootstrap tab pane has 0 width issue)
                setTimeout(() => {
                    const handbookHistoryPane = document.getElementById('handbook-history');
                    const card = handbookHistoryPane ? handbookHistoryPane.querySelector('.card') : null;
                    
                    // FIX: Force width on tab pane (critical - without this, everything has 0 width!)
                    if (handbookHistoryPane) {
                        handbookHistoryPane.style.width = '100%';
                        handbookHistoryPane.style.minWidth = '700px';
                        handbookHistoryPane.style.minHeight = '700px';
                    }
                    
                    if (tableBody) {
                        tableBody.style.height = 'auto';
                        tableBody.style.minHeight = '500px';
                        Array.from(tableBody.children).forEach(row => {
                            row.style.height = 'auto';
                            row.style.minHeight = '50px';
                            row.querySelectorAll('td').forEach(cell => {
                                cell.style.height = 'auto';
                                cell.style.minHeight = '50px';
                                cell.style.padding = '12px';
                                cell.style.fontSize = '14px';
                                cell.style.lineHeight = '1.5';
                            });
                        });
                    }
                    if (card) card.style.minHeight = '600px';
                    console.log('Handbook history dimensions forced');
                }, 50);
            } else {
                tableBody.innerHTML = '';
                noHandbooksMsg.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error loading handbook history:', error);
            loadingDiv.style.display = 'none';
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading history</td></tr>';
        });
}

// Load Evaluation History
function loadEvaluationHistory() {
    console.log('loadEvaluationHistory called');
    
    // FORCE the tab to show by manually adding Bootstrap classes
    const evaluationHistoryPane = document.getElementById('evaluation-history');
    const evaluateResumePane = document.getElementById('evaluate-resume');
    
    if (evaluationHistoryPane && evaluateResumePane) {
        // Remove active/show from evaluate resume tab
        evaluateResumePane.classList.remove('show', 'active');
        // Add active/show to evaluation history tab
        evaluationHistoryPane.classList.add('show', 'active');
        console.log('Manually switched evaluation tab panes');
    }
    
    const loadingDiv = document.getElementById('evaluation-history-loading');
    const tableBody = document.getElementById('evaluation-history-table-body');
    const noEvaluationsMsg = document.getElementById('no-evaluations-message');
    
    console.log('Elements found:', {
        loadingDiv: !!loadingDiv,
        tableBody: !!tableBody,
        noEvaluationsMsg: !!noEvaluationsMsg
    });
    
    if (!loadingDiv || !tableBody || !noEvaluationsMsg) {
        console.error('Missing required elements!');
        return;
    }
    
    loadingDiv.style.display = 'block';
    noEvaluationsMsg.style.display = 'none';
    
    console.log('Fetching evaluations from API...');
    apiFetch('/api/evaluations-only')
        .then(response => {
            console.log('API Response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('API Data received:', data);
            loadingDiv.style.display = 'none';
            
            if (data.success && data.evaluations && data.evaluations.length > 0) {
                console.log(`Rendering ${data.evaluations.length} evaluations`);
                tableBody.innerHTML = '';
                data.evaluations.forEach(evaluation => {
                    const row = document.createElement('tr');
                    const matchClass = evaluation.match_percentage >= 70 ? 'success' : 
                                      evaluation.match_percentage >= 40 ? 'warning' : 'danger';
                    row.innerHTML = `
                        <td><strong>${escapeHtml(evaluation.filename)}</strong></td>
                        <td>${escapeHtml(evaluation.job_title)}</td>
                        <td><span class="badge bg-secondary">${escapeHtml(evaluation.oorwin_job_id)}</span></td>
                        <td><span class="badge bg-${matchClass}">${evaluation.match_percentage}%</span></td>
                        <td>${new Date(evaluation.timestamp).toLocaleString()}</td>
                    `;
                    tableBody.appendChild(row);
                });
                console.log('Table populated successfully');
                
                // FORCE dimensions via JavaScript (Bootstrap tab pane has 0 width issue)
                setTimeout(() => {
                    const historyPane = document.getElementById('evaluation-history');
                    const card = historyPane ? historyPane.querySelector('.card') : null;
                    
                    // FIX: Force width on tab pane (critical - without this, everything has 0 width!)
                    if (historyPane) {
                        historyPane.style.width = '100%';
                        historyPane.style.minWidth = '700px';
                        historyPane.style.minHeight = '700px';
                    }
                    
                    if (tableBody) {
                        tableBody.style.height = 'auto';
                        tableBody.style.minHeight = '500px';
                        Array.from(tableBody.children).forEach(row => {
                            row.style.height = 'auto';
                            row.style.minHeight = '50px';
                            row.querySelectorAll('td').forEach(cell => {
                                cell.style.height = 'auto';
                                cell.style.minHeight = '50px';
                                cell.style.padding = '12px';
                                cell.style.fontSize = '14px';
                                cell.style.lineHeight = '1.5';
                            });
                        });
                    }
                    if (card) card.style.minHeight = '600px';
                    console.log('Forced dimensions applied');
                }, 50);
            } else {
                console.log('No evaluations found or empty data');
                tableBody.innerHTML = '';
                noEvaluationsMsg.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error loading evaluation history:', error);
            loadingDiv.style.display = 'none';
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading history</td></tr>';
        });
}

// View Handbook from History (same logic as before, but switch to generate tab)
function viewHandbookFromHistory(handbookId) {
    // Fetch full handbook data
    apiFetch(`/api/handbook/${handbookId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.handbook) {
                const handbook = data.handbook;
                
                // Store and display handbook
                sessionStorage.setItem('viewHandbookData', JSON.stringify(handbook));
                window.location.href = `/resume-evaluator?view_handbook=${handbook.id}`;
            } else {
                alert('Handbook not found');
            }
        })
        .catch(error => {
            console.error('Error fetching handbook:', error);
            alert('Error loading handbook details');
        });
}

// View Evaluation from History (DISABLED - removed from UI)
/* function viewEvaluationFromHistory(evalId) {
    // Fetch full evaluation data
    apiFetch(`/api/evaluation-full/${evalId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.evaluation) {
                const evaluation = data.evaluation;
                
                // Switch to "Evaluate Resume" tab
                const evaluateTab = document.getElementById('evaluate-resume-tab');
                if (evaluateTab) {
                    evaluateTab.click();
                }
                
                // Store and display evaluation
                sessionStorage.setItem('viewEvaluationData', JSON.stringify(evaluation));
                window.location.href = `/resume-evaluator?view_evaluation=${evaluation.id}`;
            }
        })
        .catch(error => {
            console.error('Error fetching evaluation:', error);
            alert('Error loading evaluation details');
        });
}
*/

// ============================================
// Unified Feedback System Functions
// ============================================

// Store current handbook ID globally
let currentHandbookId = null;

// Check if feedback already exists for evaluation
async function checkEvaluationFeedbackExists(evaluationId) {
    try {
        const response = await apiFetch(`/api/feedback/check/evaluation/${evaluationId}`);
        const data = await response.json();
        
        if (data.success && data.exists) {
            // Hide feedback form, show already submitted message
            const feedbackForm = document.getElementById('feedbackForm');
            const feedbackCard = feedbackForm?.closest('.card');
            
            if (feedbackCard) {
                feedbackCard.querySelector('.card-body').innerHTML = `
                    <div class="alert alert-success">
                        <i class="bi bi-check-circle"></i> 
                        <strong>Thank you!</strong> You've already submitted feedback for this evaluation.
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error checking evaluation feedback:', error);
    }
}

// Check if feedback already exists for handbook
async function checkHandbookFeedbackExists(handbookId) {
    try {
        const response = await apiFetch(`/api/feedback/check/handbook/${handbookId}`);
        const data = await response.json();

        const alreadySubmitted = document.getElementById('handbook-feedback-already-submitted');
        const feedbackForm = document.getElementById('handbookFeedbackForm');
        if (!alreadySubmitted || !feedbackForm) return;

        if (data.success && data.exists) {
            alreadySubmitted.innerHTML =
                '<i class="bi bi-patch-check-fill me-2 text-success" aria-hidden="true"></i>' +
                "Thank you! You've already submitted feedback for this handbook.";
            alreadySubmitted.classList.remove('d-none');
            feedbackForm.style.display = 'none';
        } else {
            alreadySubmitted.classList.add('d-none');
            feedbackForm.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking handbook feedback:', error);
        const feedbackForm = document.getElementById('handbookFeedbackForm');
        const alreadySubmitted = document.getElementById('handbook-feedback-already-submitted');
        if (alreadySubmitted) alreadySubmitted.classList.add('d-none');
        if (feedbackForm) feedbackForm.style.display = 'block';
    }
}

// Handle handbook star rating
function initializeHandbookFeedback(handbookId) {
    currentHandbookId = handbookId;
    const idInput = document.getElementById('handbook-feedback-id');
    if (idInput) idInput.value = handbookId;

    const handbookRatingInput = document.getElementById('handbook-rating-value');
    if (handbookRatingInput) handbookRatingInput.value = '';

    const handbookStarRating = document.getElementById('handbook-star-rating');
    const handbookStars = handbookStarRating?.querySelectorAll('.star');
    const paintHandbookStars = (value) => {
        if (!handbookStars) return;
        handbookStars.forEach((s) => {
            const v = parseInt(s.dataset.value, 10);
            const on = v <= value;
            s.classList.toggle('selected', on);
            s.classList.toggle('is-on', on);
            if (s.tagName === 'BUTTON') {
                s.setAttribute('aria-pressed', v === value ? 'true' : 'false');
            }
        });
    };
    if (handbookStars) {
        paintHandbookStars(0);
    }

    const comments = document.getElementById('handbook-feedback-comments');
    if (comments) comments.value = '';

    checkHandbookFeedbackExists(handbookId);

    if (handbookStarRating && handbookStars && !handbookStarRating.dataset.handbookStarsBound) {
        handbookStarRating.dataset.handbookStarsBound = '1';
        handbookStars.forEach((star) => {
            star.addEventListener('mouseover', function () {
                paintHandbookStars(parseInt(this.dataset.value, 10));
            });

            star.addEventListener('mouseout', function () {
                const current = parseInt(document.getElementById('handbook-rating-value')?.value || '0', 10) || 0;
                paintHandbookStars(current);
            });

            star.addEventListener('click', function () {
                const v = parseInt(this.dataset.value, 10);
                const inp = document.getElementById('handbook-rating-value');
                if (inp) inp.value = String(v);
                paintHandbookStars(v);
                const hint = document.getElementById('rating-hint');
                if (hint) hint.textContent = 'Selected ' + v + ' of 5.';
            });
        });
    }

    const handbookFeedbackForm = document.getElementById('handbookFeedbackForm');
    if (handbookFeedbackForm && !handbookFeedbackForm.dataset.feedbackSubmitBound) {
        handbookFeedbackForm.dataset.feedbackSubmitBound = '1';
        handbookFeedbackForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formData = new FormData(this);
            const feedbackData = {
                handbook_id: parseInt(formData.get('handbook_id'), 10),
                rating: parseInt(formData.get('rating'), 10),
                comments: formData.get('comments')
            };

            if (!feedbackData.rating) {
                alert('Please select a rating before submitting');
                return;
            }

            try {
                const response = await apiFetch('/api/feedback/handbook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(feedbackData)
                });

                const data = await response.json();

                if (data.success) {
                    const alreadySubmitted = document.getElementById('handbook-feedback-already-submitted');
                    const feedbackForm = document.getElementById('handbookFeedbackForm');
                    if (alreadySubmitted) {
                        alreadySubmitted.innerHTML =
                            '<i class="bi bi-patch-check-fill me-2 text-success" aria-hidden="true"></i>' +
                            '<strong>Thank you!</strong> Your feedback has been submitted successfully.';
                        alreadySubmitted.classList.remove('d-none');
                    }
                    if (feedbackForm) {
                        feedbackForm.style.display = 'none';
                        feedbackForm.reset();
                    }
                    const ratingEl = document.getElementById('handbook-rating-value');
                    if (ratingEl) ratingEl.value = '';
                    const starEls = document.getElementById('handbook-star-rating')?.querySelectorAll('.star');
                    if (starEls) {
                        starEls.forEach((s) => {
                            s.classList.remove('selected', 'is-on');
                            if (s.tagName === 'BUTTON') s.setAttribute('aria-pressed', 'false');
                        });
                    }
                    const hint = document.getElementById('rating-hint');
                    if (hint) hint.textContent = '';
                } else {
                    alert(data.error || 'Failed to submit feedback');
                }
            } catch (error) {
                console.error('Error submitting handbook feedback:', error);
                alert('An error occurred while submitting feedback');
            }
        });
    }
}

// Export for global access
window.checkEvaluationFeedbackExists = checkEvaluationFeedbackExists;
window.initializeHandbookFeedback = initializeHandbookFeedback;

// View Evaluation from History (optional helper function)
function viewEvaluationFromHistory(evalId) {
    window.location.href = `/resume-evaluator?view_evaluation=${evalId}`;
}

function showExistingHandbookModal(data) {
    // Remove existing modal if present
    const existingModal = document.getElementById('existingHandbookModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="existingHandbookModal" tabindex="-1" aria-labelledby="existingHandbookModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title" id="existingHandbookModalLabel">
                            <i class="bi bi-info-circle-fill me-2"></i>Handbook Already Exists
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info mb-0">
                            <i class="bi bi-info-circle me-2"></i>
                            <strong>${data.message}</strong>
                        </div>
                        ${data.created_by ? `
                            <div class="mt-3">
                                <small class="text-muted">
                                    <i class="bi bi-person-circle me-1"></i>
                                    <strong>Created by:</strong> ${data.created_by}
                                    <br>
                                    <i class="bi bi-calendar3 me-1"></i>
                                    <strong>Created on:</strong> ${new Date(data.created_at).toLocaleString()}
                                </small>
                            </div>
                        ` : ''}
                        <p class="mt-3 mb-0">
                            The existing handbook is displayed below. You can view, download, or provide feedback on it.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                            <i class="bi bi-check-circle me-1"></i>Okay, Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Insert modal into body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal using Bootstrap
    const modalElement = document.getElementById('existingHandbookModal');
    
    // Use Bootstrap Modal API
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true
        });
        modal.show();
        
        // Clean up modal when hidden
        modalElement.addEventListener('hidden.bs.modal', function() {
            modalElement.remove();
        });
    } else {
        // Fallback: Use jQuery if Bootstrap JS not loaded but jQuery is available
        if (typeof $ !== 'undefined') {
            $(modalElement).modal('show');
            $(modalElement).on('hidden.bs.modal', function() {
                $(modalElement).remove();
            });
        } else {
            // Last resort: Simple alert
            alert(`Handbook Already Exists: ${data.message}\n\nThe existing handbook is displayed below.`);
        }
    }
}

window.buildHandbookIntelligenceWorkspace = buildHandbookIntelligenceWorkspace;
window.addCopyButtonsToBooleanSamples = addCopyButtonsToBooleanSamples;

if (!window.__handbookCopyDelegated) {
    window.__handbookCopyDelegated = true;
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.handbook-copy-btn');
        if (!btn || !btn.dataset.copyText) return;
        e.preventDefault();
        copyToClipboard(btn.dataset.copyText, btn);
    });
}
