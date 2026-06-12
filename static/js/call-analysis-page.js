/**
 * Dedicated Call Analysis page (/call-analysis).
 */
(function () {
    'use strict';

    function apiFetch(url, options) {
        return (typeof plutoFetch === 'function' ? plutoFetch : fetch)(url, options);
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function setStep(activeStep) {
        var steps = ['fetch', 'download', 'merge', 'analyze'];
        var idx = steps.indexOf(activeStep);
        document.querySelectorAll('.call-analysis-steps li').forEach(function (li) {
            var s = li.getAttribute('data-step');
            var si = steps.indexOf(s);
            li.classList.remove('is-active', 'is-done');
            if (si < idx) li.classList.add('is-done');
            if (si === idx) li.classList.add('is-active');
        });
    }

    function showStatus(show, text) {
        var panel = document.getElementById('call-analysis-status');
        var textEl = document.getElementById('call-analysis-status-text');
        if (panel) panel.style.display = show ? 'block' : 'none';
        if (textEl && text) textEl.textContent = text;
    }

    function showResults(show) {
        var empty = document.getElementById('call-analysis-empty');
        var results = document.getElementById('call-analysis-results');
        if (empty) empty.style.display = show ? 'none' : 'block';
        if (results) results.style.display = show ? 'block' : 'none';
    }

    function renderTimeline(calls, meta) {
        var el = document.getElementById('call-analysis-calls-timeline');
        if (!el) return;
        meta = meta || {};
        var filterNote = meta.dur_filter_note ||
            'Showing calls with duration > 5 seconds only';
        var fetched = meta.total_logs_fetched;
        var excluded = meta.excluded_below_min_dur;
        var subtitle = filterNote;
        if (fetched != null && excluded != null) {
            subtitle += ' (' + calls.length + ' of ' + fetched + ' log rows from VoxPro)';
        }
        if (!calls || !calls.length) {
            el.innerHTML =
                '<p class="fw-semibold mb-1">Call log</p>' +
                '<p class="small text-muted mb-2">' + escapeHtml(subtitle) + '</p>' +
                '<p class="text-muted mb-0">No calls met the duration filter for this run.</p>';
            return;
        }
        var rows = calls.map(function (c) {
            return '<tr>' +
                '<td>' + escapeHtml(c.datetime || '—') + '</td>' +
                '<td>' + escapeHtml(c.status || '') + '</td>' +
                '<td>' + escapeHtml(c.callmethod || '') + '</td>' +
                '<td>' + escapeHtml(c.dur || '—') + 's</td>' +
                '<td class="small">' + escapeHtml(c.email_id || '') + '</td>' +
                '</tr>';
        }).join('');
        el.innerHTML =
            '<p class="fw-semibold mb-1">Call log</p>' +
            '<p class="small text-muted mb-2">' + escapeHtml(subtitle) + '</p>' +
            '<div class="table-responsive"><table class="table table-sm table-striped mb-0">' +
            '<thead><tr><th>Date</th><th>Status</th><th>Dir</th><th>Dur</th><th>Agent</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>';
    }

    function renderReport(data) {
        var badge = document.getElementById('call-analysis-meta-badge');
        var report = document.getElementById('call-analysis-report');
        var transcript = document.getElementById('call-analysis-transcript');

        if (badge) {
            var minDur = data.min_dur_seconds != null ? data.min_dur_seconds : 5;
            badge.textContent =
                (data.call_count || 0) + ' call(s) >' + minDur + 's · ' +
                (data.stt_method || 'STT') + ' · ' +
                (data.time_taken != null ? data.time_taken + 's' : '');
        }

        var md = data.analysis_markdown || '';
        if (report) {
            if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined' && md) {
                report.innerHTML = DOMPurify.sanitize(marked.parse(md));
            } else {
                report.innerHTML = '<pre class="small">' + escapeHtml(md) + '</pre>';
            }
        }

        var fullTranscript = data.merged_transcript || data.transcript_preview || '';
        if (transcript) {
            transcript.textContent = fullTranscript || '(No transcript text returned.)';
        }

        if (data.ingest && data.ingest.calls) {
            renderTimeline(data.ingest.calls, data.ingest);
        } else if (data.ingest) {
            renderTimeline([], data.ingest);
        }
    }

    async function runAnalysis(phone, jobId) {
        var btn = document.getElementById('callAnalysisSubmitBtn');
        showResults(false);
        showStatus(true, 'Starting…');
        setStep('fetch');
        if (btn) btn.disabled = true;

        try {
            setStep('download');
            var res = await apiFetch('/api/voxpro/calls/analyze', {
                method: 'POST',
                body: {
                    phone: phone,
                    oorwin_job_id: jobId || undefined,
                },
            });
            setStep('analyze');
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.success) {
                throw new Error(
                    data.error ||
                    ('Analysis failed (HTTP ' + res.status + ')')
                );
            }
            document.querySelectorAll('.call-analysis-steps li').forEach(function (li) {
                li.classList.remove('is-active');
                li.classList.add('is-done');
            });
            showStatus(false);
            showResults(true);
            renderReport(data);

            if (data.analysis_id && window.history && window.history.replaceState) {
                var url = new URL(window.location.href);
                url.searchParams.set('phone', phone);
                if (jobId) url.searchParams.set('job_id', jobId);
                window.history.replaceState({}, '', url);
            }
        } catch (err) {
            console.error(err);
            showStatus(true, 'Error: ' + (err.message || 'Analysis failed'));
            document.getElementById('call-analysis-status-text').classList.add('text-danger');
            showResults(false);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function tryLoadCached(phone) {
        try {
            var res = await apiFetch('/api/voxpro/calls?phone=' + encodeURIComponent(phone));
            var data = await res.json();
            if (!data.success || !data.latest_analysis) return;
            var a = data.latest_analysis;
            if (!a.analysis_markdown && !a.analysis_json) return;
            showResults(true);
            renderReport({
                call_count: a.call_count,
                min_dur_seconds: data.min_dur_seconds,
                stt_method: a.stt_method,
                time_taken: a.time_taken,
                analysis_markdown: a.analysis_markdown,
                transcript_preview: a.merged_transcript
                    ? a.merged_transcript.substring(0, 8000)
                    : '',
                ingest: {
                    calls: data.calls || [],
                    dur_filter_note: data.dur_filter_note,
                    min_dur_seconds: data.min_dur_seconds,
                },
            });
        } catch (e) {
            /* ignore */
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('callAnalysisForm');
        var phoneInput = document.getElementById('call_analysis_phone');

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var phone = phoneInput && phoneInput.value.trim();
                if (!phone) return;
                var jobEl = document.getElementById('call_analysis_job_id');
                var jobId = jobEl && jobEl.value.trim();
                var statusText = document.getElementById('call-analysis-status-text');
                if (statusText) statusText.classList.remove('text-danger');
                runAnalysis(phone, jobId);
            });
        }

        if (phoneInput && phoneInput.value.trim()) {
            tryLoadCached(phoneInput.value.trim());
        }
    });
})();
