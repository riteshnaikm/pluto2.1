/**
 * Job-centric history — Co-Pilot aligned UI
 */
(function () {
    'use strict';

    let jobsData = [];
    let activeFilter = 'all';
    let sortBy = 'last_activity';

    const SCORE_STRONG = 70;
    const SCORE_MODERATE = 40;

    document.addEventListener('DOMContentLoaded', function () {
        bindToolbar();
        loadJobHistory();
    });

    function bindToolbar() {
        const filterInput = document.getElementById('job-filter');
        const clearBtn = document.getElementById('clear-job-filter');
        const sortSelect = document.getElementById('history-sort');

        if (filterInput) filterInput.addEventListener('input', applyFilters);
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (filterInput) filterInput.value = '';
                applyFilters();
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                sortBy = sortSelect.value;
                applyFilters();
            });
        }

        document.querySelectorAll('.history-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('.history-filter-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                activeFilter = btn.getAttribute('data-filter') || 'all';
                applyFilters();
            });
        });
    }

    async function loadJobHistory() {
        const loadingDiv = document.getElementById('history-loading');
        const contentDiv = document.getElementById('history-content');
        const emptyDiv = document.getElementById('history-empty');
        const errorDiv = document.getElementById('history-error');

        try {
            if (loadingDiv) loadingDiv.style.display = 'block';
            if (contentDiv) contentDiv.style.display = 'none';
            if (emptyDiv) emptyDiv.style.display = 'none';
            if (errorDiv) errorDiv.style.display = 'none';

            const fn = typeof plutoFetch === 'function' ? plutoFetch : fetch;
            const response = await fn('/api/job-centric-history');
            const data = await response.json();

            if (data.success) {
                jobsData = data.jobs || [];
                updateSummaryStats(jobsData);
                if (jobsData.length > 0) {
                    if (contentDiv) contentDiv.style.display = 'block';
                    applyFilters();
                } else if (emptyDiv) {
                    emptyDiv.style.display = 'block';
                }
            } else {
                throw new Error(data.message || 'Failed to load job history');
            }
        } catch (error) {
            console.error('Error loading job history:', error);
            const msgEl = document.getElementById('history-error-message');
            if (msgEl) msgEl.textContent = error.message;
            if (errorDiv) errorDiv.style.display = 'block';
        } finally {
            if (loadingDiv) loadingDiv.style.display = 'none';
        }
    }

    function updateSummaryStats(jobs) {
        let totalEvals = 0;
        let withHandbook = 0;
        let matchSum = 0;
        let matchCount = 0;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let activeWeek = 0;

        jobs.forEach(function (job) {
            totalEvals += job.evaluations_count || 0;
            if ((job.handbooks_count || 0) > 0) withHandbook++;
            (job.resume_list || []).forEach(function (r) {
                if (r.match_percentage != null) {
                    matchSum += Number(r.match_percentage);
                    matchCount++;
                }
            });
            const last = job.last_activity ? new Date(job.last_activity).getTime() : 0;
            if (last >= weekAgo) activeWeek++;
        });

        setText('stat-total-jobs', jobs.length);
        setText('stat-with-handbook', withHandbook);
        setText('stat-total-evals', totalEvals);
        setText('stat-active-week', activeWeek);
        const avg = matchCount > 0 ? Math.round(matchSum / matchCount) : '—';
        setText('stat-avg-match', avg === '—' ? '—' : avg + '%');
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    }

    function getFilteredJobs() {
        const q = (document.getElementById('job-filter')?.value || '').toLowerCase().trim();
        let list = jobsData.slice();

        if (activeFilter === 'handbook') {
            list = list.filter(function (j) { return (j.handbooks_count || 0) > 0; });
        } else if (activeFilter === 'evaluations') {
            list = list.filter(function (j) { return (j.evaluations_count || 0) > 0; });
        } else if (activeFilter === 'needs-eval') {
            list = list.filter(function (j) { return (j.handbooks_count || 0) > 0 && (j.evaluations_count || 0) === 0; });
        }

        if (q) {
            list = list.filter(function (j) {
                return (j.job_id || '').toLowerCase().includes(q) ||
                    (j.job_title || '').toLowerCase().includes(q);
            });
        }

        list.sort(function (a, b) {
            if (sortBy === 'title') {
                return (a.job_title || '').localeCompare(b.job_title || '');
            }
            if (sortBy === 'evaluations') {
                return (b.evaluations_count || 0) - (a.evaluations_count || 0);
            }
            if (sortBy === 'first_created') {
                return new Date(b.first_created || 0) - new Date(a.first_created || 0);
            }
            return new Date(b.last_activity || 0) - new Date(a.last_activity || 0);
        });

        return list;
    }

    function applyFilters() {
        const jobs = getFilteredJobs();
        const countBadge = document.getElementById('job-count');
        if (countBadge) {
            countBadge.textContent = jobs.length + ' job' + (jobs.length !== 1 ? 's' : '');
        }
        renderJobCards(jobs);
    }

    function scoreTierClass(pct) {
        const s = Number(pct) || 0;
        if (s >= SCORE_STRONG) return 'score-strong';
        if (s >= SCORE_MODERATE) return 'score-moderate';
        return 'score-weak';
    }

    function avgMatchTier(avg) {
        if (avg == null || isNaN(avg)) return '';
        if (avg >= SCORE_STRONG) return 'pill-avg-strong';
        if (avg >= SCORE_MODERATE) return 'pill-avg-moderate';
        return 'pill-avg-weak';
    }

    function isBatchEvaluation(item) {
        return item && String(item.evaluation_mode || 'single').toLowerCase() === 'batch';
    }

    function evalModeIcon(mode, extraClass) {
        const batch = String(mode || 'single').toLowerCase() === 'batch';
        if (batch) {
            return '<i class="bi bi-people-fill eval-mode-icon eval-mode-batch ' + (extraClass || '') +
                '" title="Batch comparison (multi-resume)" aria-hidden="true"></i>';
        }
        return '<i class="bi bi-person-check eval-mode-icon eval-mode-single ' + (extraClass || '') +
            '" title="Single resume evaluation" aria-hidden="true"></i>';
    }

    function resumeChipLabel(resume) {
        return (resume.candidate_name || displayResumeName(resume.filename) || 'Resume').trim();
    }

    function jobAvgMatch(job) {
        const list = job.resume_list || [];
        if (!list.length) return null;
        const sum = list.reduce(function (a, r) { return a + (Number(r.match_percentage) || 0); }, 0);
        return Math.round(sum / list.length);
    }

    function renderJobCards(jobs) {
        const container = document.getElementById('job-cards-container');
        if (!container) return;

        if (!jobs.length) {
            container.innerHTML = '<p class="text-center text-muted py-4 mb-0">No jobs match your search or filter.</p>';
            return;
        }

        container.innerHTML = jobs.map(function (job) {
            const index = jobsData.findIndex(function (j) { return j.job_id === job.job_id; });
            const avg = jobAvgMatch(job);
            const avgClass = avgMatchTier(avg);
            const hasHandbook = (job.handbooks_count || 0) > 0;

            let titleHtml;
            if (hasHandbook) {
                titleHtml = '<a href="#" class="open-handbook-link" data-job-index="' + index + '">' +
                    escapeHtml(job.job_title) + '</a>';
            } else {
                titleHtml = escapeHtml(job.job_title);
            }

            let chips = '';
            const resumes = (job.resume_list || []).slice(0, 4);
            resumes.forEach(function (resume) {
                const label = resumeChipLabel(resume);
                const tier = scoreTierClass(resume.match_percentage);
                const modeIcon = evalModeIcon(resume.evaluation_mode);
                const tip = isBatchEvaluation(resume) ? 'Batch comparison — view evaluation' : 'Single evaluation — view';
                chips += '<button type="button" class="resume-chip' +
                    (isBatchEvaluation(resume) ? ' resume-chip--batch' : ' resume-chip--single') +
                    '" data-job-index="' + index + '" title="' + escapeHtml(tip) + '">' +
                    modeIcon +
                    '<span class="text-truncate" style="max-width:120px">' + escapeHtml(truncateFilename(label, 20)) + '</span>' +
                    '<span class="' + tier + '">(' + resume.match_percentage + '%)</span></button>';
            });
            if ((job.resume_list || []).length > 4) {
                chips += '<button type="button" class="btn btn-sm btn-outline-primary resume-chip-more" data-job-index="' + index + '">+' +
                    (job.resume_list.length - 4) + ' more</button>';
            }
            if (!job.evaluations_count) {
                chips = '<span class="text-muted small">No evaluations yet — run MatchMaker for this job.</span>';
            }

            const evaluators = (job.res_evaluated_by || []).slice(0, 3).map(function (u) {
                return '<span class="badge bg-success" title="' + escapeHtml(u.email || '') + '">' +
                    escapeHtml(u.name || 'Unknown') + '</span>';
            }).join(' ');

            return (
                '<article class="job-card" data-job-id="' + escapeHtml(job.job_id) + '" data-job-title="' + escapeHtml(job.job_title) + '">' +
                '<div class="job-card-header">' +
                '<div>' +
                '<span class="job-id-badge">' + escapeHtml(job.job_id) + '</span>' +
                '<h3 class="job-card-title">' + titleHtml + '</h3>' +
                '<div class="job-meta-row">' +
                '<span><i class="bi bi-calendar3"></i> First ' + formatDateShort(job.first_created) + '</span>' +
                '<span><i class="bi bi-clock"></i> Last ' + formatDateShort(job.last_activity) + '</span>' +
                '</div></div>' +
                '<div class="job-card-actions">' +
                (hasHandbook ? '<button type="button" class="btn btn-outline-primary btn-sm open-handbook-link" data-job-index="' + index + '"><i class="bi bi-book"></i> Handbook</button>' : '') +
                '<button type="button" class="btn btn-outline-secondary btn-sm view-evals-btn" data-job-index="' + index + '"><i class="bi bi-list-check"></i> Evaluations</button>' +
                '<a href="/resume-evaluator?section=matchmaker&amp;job_id=' + encodeURIComponent(job.job_id) + '" class="btn btn-primary btn-sm"><i class="bi bi-person-check"></i> Evaluate</a>' +
                '</div></div>' +
                '<div class="d-flex flex-wrap gap-2 mb-2">' +
                '<span class="job-pill pill-handbook"><i class="bi bi-book"></i> ' + (job.handbooks_count || 0) + ' handbook</span>' +
                '<span class="job-pill pill-eval"><i class="bi bi-file-earmark-person"></i> ' + (job.evaluations_count || 0) + ' evaluations</span>' +
                (avg != null ? '<span class="job-pill ' + avgClass + '"><i class="bi bi-speedometer2"></i> Avg ' + avg + '%</span>' : '') +
                '</div>' +
                (evaluators ? '<div class="small text-muted mb-1">Evaluated by: ' + evaluators + '</div>' : '') +
                '<div class="resume-chips">' + chips + '</div>' +
                '</article>'
            );
        }).join('');

        container.querySelectorAll('.open-handbook-link').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                openHandbookForJob(parseInt(el.getAttribute('data-job-index'), 10));
            });
        });
        container.querySelectorAll('.view-evals-btn, .resume-chip, .resume-chip-more').forEach(function (el) {
            el.addEventListener('click', function () {
                showEvaluationsModal(jobsData[parseInt(el.getAttribute('data-job-index'), 10)]);
            });
        });
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatDateShort(dateString) {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function displayResumeName(storedName) {
        if (!storedName) return 'Resume';
        const name = String(storedName).trim();
        const m = name.match(/^[a-f0-9]{32}_(.+)$/i);
        return m ? m[1] : name;
    }

    function truncateFilename(filename, maxLength) {
        if (!filename) return 'Resume';
        const label = displayResumeName(filename);
        if (label.length <= maxLength) return label;
        const dot = label.lastIndexOf('.');
        if (dot > 0 && dot < label.length - 1) {
            const ext = label.slice(dot + 1);
            const base = label.slice(0, dot);
            const keep = Math.max(4, maxLength - ext.length - 4);
            return base.slice(0, keep) + '...' + ext;
        }
        return label.slice(0, Math.max(4, maxLength - 3)) + '...';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : text;
        return div.innerHTML;
    }

    async function openHandbookForJob(jobIndex) {
        const job = jobsData[jobIndex];
        if (!job || !job.job_id) {
            alert('Job information not available.');
            return;
        }
        try {
            const fn = typeof plutoFetch === 'function' ? plutoFetch : fetch;
            const response = await fn('/api/handbooks-by-job/' + encodeURIComponent(job.job_id));
            const data = await response.json();
            if (data.success && data.handbooks && data.handbooks.length > 0) {
                sessionStorage.setItem('viewHandbookData', JSON.stringify(data.handbooks[0]));
                window.location.href = '/resume-evaluator?view_handbook=' + data.handbooks[0].id;
            } else {
                alert('No handbook found for this Job ID.');
            }
        } catch (error) {
            console.error('Error opening handbook:', error);
            alert('Error loading handbook. Please try again.');
        }
    }

    async function showEvaluationsModal(job) {
        const modalEl = document.getElementById('evaluationsModal');
        const modalBody = document.getElementById('evaluationsModalBody');
        if (!modalEl || !modalBody) return;

        document.getElementById('evaluationsModalLabel').innerHTML =
            '<i class="bi bi-file-earmark-text"></i> ' + escapeHtml(job.job_title) +
            ' <span class="job-id-badge ms-2">' + escapeHtml(job.job_id) + '</span>';

        modalBody.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><p class="mt-2 mb-0">Loading evaluations…</p></div>';
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        try {
            const fn = typeof plutoFetch === 'function' ? plutoFetch : fetch;
            const response = await fn('/api/evaluations-by-job/' + encodeURIComponent(job.job_id));
            const data = await response.json();

            if (data.success && data.evaluations && data.evaluations.length > 0) {
                modalBody.innerHTML =
                    '<div class="mb-3 small text-muted">' + data.evaluations.length + ' evaluation(s) for this job</div>' +
                    data.evaluations.map(function (ev) {
                        const tier = scoreTierClass(ev.match_percentage).replace('score-', 'tier-');
                        const name = ev.candidate_name || ev.display_filename || displayResumeName(ev.filename);
                        const batch = isBatchEvaluation(ev);
                        return (
                            '<div class="eval-row">' +
                            '<div>' +
                            evalModeIcon(ev.evaluation_mode) +
                            '<strong>' + escapeHtml(name) + '</strong>' +
                            (batch ? ' <span class="badge eval-mode-badge-batch">Batch</span>' : ' <span class="badge eval-mode-badge-single">Single</span>') +
                            '<br><small class="text-muted">' + formatDate(ev.timestamp) + '</small></div>' +
                            '<div class="match-ring-sm ' + tier + '">' + ev.match_percentage + '%</div>' +
                            '<span class="badge bg-success">' + escapeHtml(ev.evaluator_name || 'Unknown') + '</span>' +
                            '<button type="button" class="btn btn-sm btn-primary view-evaluation-btn" data-eval-id="' + ev.id + '"><i class="bi bi-eye"></i> View</button>' +
                            '</div>'
                        );
                    }).join('');

                modalBody.querySelectorAll('.view-evaluation-btn').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        viewEvaluationDetails(btn.getAttribute('data-eval-id'));
                    });
                });
            } else {
                modalBody.innerHTML = '<p class="text-muted mb-0">No evaluations yet. <a href="/resume-evaluator?section=matchmaker&amp;job_id=' +
                    encodeURIComponent(job.job_id) + '">Evaluate a resume</a> for this job.</p>';
            }
        } catch (error) {
            modalBody.innerHTML = '<div class="alert alert-danger mb-0">Error loading evaluations: ' + escapeHtml(error.message) + '</div>';
        }
    }

    async function viewEvaluationDetails(evalId) {
        try {
            const fn = typeof plutoFetch === 'function' ? plutoFetch : fetch;
            const response = await fn('/api/evaluation-full/' + evalId);
            const data = await response.json();
            if (data.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('evaluationsModal'));
                if (modal) modal.hide();
                sessionStorage.setItem('viewEvaluationData', JSON.stringify(data.evaluation));
                window.location.href = '/resume-evaluator?view_evaluation=' + evalId;
            } else {
                alert('Error loading evaluation: ' + (data.message || 'Unknown'));
            }
        } catch (error) {
            alert('Error loading evaluation details.');
        }
    }

    window.openHandbookForJob = openHandbookForJob;
    window.showEvaluationsModal = showEvaluationsModal;
})();
