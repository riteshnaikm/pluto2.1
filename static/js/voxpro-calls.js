/**
 * VoxPro call fetch + analyze (MatchMaker / History).
 */
(function () {
    'use strict';

    function apiFetch(url, options) {
        return (typeof plutoFetch === 'function' ? plutoFetch : fetch)(url, options);
    }

    function getPhoneInput() {
        return document.getElementById('candidate_phone') ||
            document.getElementById('voxpro_history_phone');
    }

    function getJobId() {
        const el = document.getElementById('oorwin_job_id');
        return el && el.value ? el.value.trim() : null;
    }

    function showStatus(msg, isError) {
        const el = document.getElementById('voxpro-status');
        if (!el) return;
        el.style.display = 'block';
        el.className = 'voxpro-status small mt-2 ' + (isError ? 'text-danger' : 'text-muted');
        el.textContent = msg;
    }

    function renderAnalysis(data) {
        const panel = document.getElementById('voxpro-results');
        if (!panel) return;
        panel.style.display = 'block';
        const md = data.analysis_markdown || '';
        const preview = data.transcript_preview || '';
        let html = '';
        if (data.call_count != null) {
            html += '<p class="small text-muted mb-2">' + data.call_count + ' call(s) · STT: ' +
                (data.stt_method || '—') + ' · ' + (data.time_taken || '') + 's</p>';
        }
        if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined' && md) {
            html += '<div class="voxpro-analysis-md">' +
                DOMPurify.sanitize(marked.parse(md)) + '</div>';
        } else if (md) {
            html += '<pre class="small">' + escapeHtml(md) + '</pre>';
        }
        if (preview) {
            html += '<details class="mt-3"><summary class="small">Transcript preview</summary>' +
                '<pre class="small text-muted mt-2">' + escapeHtml(preview) + '</pre></details>';
        }
        panel.innerHTML = html;
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    async function analyzeCalls(btn) {
        const phoneEl = getPhoneInput();
        if (!phoneEl || !phoneEl.value.trim()) {
            showStatus('Enter a 10-digit candidate phone number.', true);
            return;
        }
        const phone = phoneEl.value.trim();
        const payload = {
            phone: phone,
            oorwin_job_id: getJobId() || undefined,
        };
        if (btn) {
            btn.disabled = true;
            btn.dataset.origText = btn.textContent;
            btn.textContent = 'Analyzing calls…';
        }
        showStatus('Fetching VoxPro logs, recordings, transcribing, and analyzing…');
        try {
            const res = await apiFetch('/api/voxpro/calls/analyze', {
                method: 'POST',
                body: payload,
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Analysis failed');
            }
            showStatus('Call analysis complete.');
            renderAnalysis(data);
        } catch (err) {
            console.error(err);
            showStatus(err.message || 'Call analysis failed', true);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.origText || 'Analyze VoxPro calls';
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const btn = document.getElementById('voxproAnalyzeBtn');
        const historyBtn = document.getElementById('voxproHistoryAnalyzeBtn');
        if (btn) btn.addEventListener('click', function () { analyzeCalls(btn); });
        if (historyBtn) historyBtn.addEventListener('click', function () { analyzeCalls(historyBtn); });
    });
})();
