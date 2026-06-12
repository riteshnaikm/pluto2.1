/**
 * Recruitment intake form — collect / validate / populate handbook payload.
 */
(function (global) {
    function checkedValues(form, name) {
        return Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (el) {
            return el.value;
        });
    }

    function radioValue(form, name) {
        var el = form.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value : '';
    }

    function addSkillRow(tbody, skill, years, rating) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td><input type="text" class="form-control form-control-sm intake-skill-name" value="' +
            (skill || '').replace(/"/g, '&quot;') +
            '" placeholder="Skill name" required></td>' +
            '<td><input type="text" class="form-control form-control-sm intake-skill-years" value="' +
            (years || '').replace(/"/g, '&quot;') +
            '" placeholder="Yrs"></td>' +
            '<td><input type="number" class="form-control form-control-sm intake-skill-rating" min="1" max="5" value="' +
            (rating || '').replace(/"/g, '&quot;') +
            '" placeholder="1-5"></td>' +
            '<td><button type="button" class="btn btn-outline-danger btn-sm btn-remove-skill" title="Remove">&times;</button></td>';
        tbody.appendChild(tr);
        tr.querySelector('.btn-remove-skill').addEventListener('click', function () {
            if (tbody.querySelectorAll('tr').length > 1) {
                tr.remove();
            }
        });
    }

    function collectMustHaveSkills(form) {
        var rows = form.querySelectorAll('#intake-must-have-skills-body tr');
        var skills = [];
        rows.forEach(function (tr) {
            var skill = (tr.querySelector('.intake-skill-name')?.value || '').trim();
            if (!skill) return;
            skills.push({
                skill: skill,
                years: (tr.querySelector('.intake-skill-years')?.value || '').trim(),
                rating: (tr.querySelector('.intake-skill-rating')?.value || '').trim(),
            });
        });
        return skills;
    }

    function collectHandbookIntakePayload(form) {
        if (!form) form = document.getElementById('handbookGenerationForm');
        if (!form) return null;

        var reqId = (form.querySelector('#handbook_oorwin_job_id')?.value || '').trim();
        var intake = {
            schema_version: 1,
            req_id: reqId,
            priority: radioValue(form, 'intake_priority') || 'med',
            job_title: (form.querySelector('#handbook_job_title')?.value || '').trim(),
            role_type: checkedValues(form, 'intake_role_type'),
            job_location: (form.querySelector('#intake_job_location')?.value || '').trim(),
            in_city_location: (form.querySelector('#intake_in_city')?.value || '').trim(),
            work_mode: checkedValues(form, 'intake_work_mode'),
            working_days: checkedValues(form, 'intake_working_days'),
            working_days_custom: (form.querySelector('#intake_working_days_custom')?.value || '').trim(),
            shift: radioValue(form, 'intake_shift') || 'ist_general',
            shift_start: (form.querySelector('#intake_shift_start')?.value || '').trim(),
            shift_end: (form.querySelector('#intake_shift_end')?.value || '').trim(),
            budget_min_lpa: (form.querySelector('#intake_budget_min')?.value || '').trim(),
            budget_max_lpa: (form.querySelector('#intake_budget_max')?.value || '').trim(),
            travel_requirement: checkedValues(form, 'intake_travel'),
            experience_years: checkedValues(form, 'intake_experience'),
            education: checkedValues(form, 'intake_education'),
            must_have_skills: collectMustHaveSkills(form),
            good_to_have_skills: (form.querySelector('#intake_good_to_have')?.value || '').trim(),
            notice_period: checkedValues(form, 'intake_notice'),
            interview_levels: checkedValues(form, 'intake_interview_levels'),
            assessments: checkedValues(form, 'intake_assessments'),
            interview_process: (form.querySelector('#intake_interview_process')?.value || '').trim(),
            hiring_urgency: radioValue(form, 'intake_hiring_urgency') || 'standard',
            job_description: (form.querySelector('#handbook_job_description')?.value || '').trim(),
            sourcing_notes: (form.querySelector('#intake_sourcing_notes')?.value || '').trim(),
            additional_context: (form.querySelector('#handbook_additional_context')?.value || '').trim(),
        };

        var transcriptPath = (form.querySelector('#selected_transcript_path')?.value || '').trim();

        return {
            job_title: intake.job_title,
            job_description: intake.job_description,
            additional_context: intake.additional_context,
            oorwin_job_id: reqId,
            selected_transcript_path: transcriptPath,
            intake: intake,
        };
    }

    function validateHandbookIntake(payload) {
        if (!payload || !payload.intake) {
            return { ok: false, message: 'Form data missing' };
        }
        var i = payload.intake;
        if (!i.job_title) return { ok: false, message: 'Position title is required.' };
        if (!i.job_location) return { ok: false, message: 'Job location is required.' };
        if (!i.role_type || !i.role_type.length) return { ok: false, message: 'Select at least one role type.' };
        if (!i.budget_min_lpa || !i.budget_max_lpa) return { ok: false, message: 'Budget min and max (LPA) are required.' };
        if (!i.experience_years || !i.experience_years.length) return { ok: false, message: 'Select years of experience.' };
        if (!i.must_have_skills || !i.must_have_skills.length) return { ok: false, message: 'Add at least one must-have skill.' };
        if (!i.job_description) return { ok: false, message: 'Job description is required.' };
        if (!i.interview_levels || !i.interview_levels.length) return { ok: false, message: 'Select interview levels.' };
        return { ok: true };
    }

    function setCheckboxGroup(form, name, values) {
        if (!values) values = [];
        form.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
            el.checked = values.indexOf(el.value) >= 0;
        });
    }

    function setRadio(form, name, value) {
        form.querySelectorAll('input[name="' + name + '"]').forEach(function (el) {
            el.checked = el.value === value;
        });
    }

    function populateHandbookIntakeForm(data) {
        var form = document.getElementById('handbookGenerationForm');
        if (!form || !data) return;

        var intake = data.intake || {};
        var set = function (id, val) {
            var el = form.querySelector('#' + id);
            if (el && val != null && val !== '') el.value = val;
        };

        set('handbook_oorwin_job_id', data.oorwin_job_id || intake.req_id);
        set('handbook_job_title', data.job_title || intake.job_title);
        set('handbook_job_description', data.job_description || intake.job_description);
        set('handbook_additional_context', data.additional_context || intake.additional_context);
        set('intake_job_location', intake.job_location);
        set('intake_in_city', intake.in_city_location);
        set('intake_working_days_custom', intake.working_days_custom);
        set('intake_budget_min', intake.budget_min_lpa);
        set('intake_budget_max', intake.budget_max_lpa);
        set('intake_good_to_have', intake.good_to_have_skills);
        set('intake_interview_process', intake.interview_process);
        set('intake_sourcing_notes', intake.sourcing_notes);
        set('intake_shift_start', intake.shift_start);
        set('intake_shift_end', intake.shift_end);

        if (intake.priority) setRadio(form, 'intake_priority', intake.priority);
        if (intake.shift) setRadio(form, 'intake_shift', intake.shift);
        if (intake.hiring_urgency) setRadio(form, 'intake_hiring_urgency', intake.hiring_urgency);

        setCheckboxGroup(form, 'intake_role_type', intake.role_type);
        setCheckboxGroup(form, 'intake_work_mode', intake.work_mode);
        setCheckboxGroup(form, 'intake_working_days', intake.working_days);
        setCheckboxGroup(form, 'intake_travel', intake.travel_requirement);
        setCheckboxGroup(form, 'intake_experience', intake.experience_years);
        setCheckboxGroup(form, 'intake_education', intake.education);
        setCheckboxGroup(form, 'intake_notice', intake.notice_period);
        setCheckboxGroup(form, 'intake_interview_levels', intake.interview_levels);
        setCheckboxGroup(form, 'intake_assessments', intake.assessments);

        var tbody = form.querySelector('#intake-must-have-skills-body');
        if (tbody && intake.must_have_skills && intake.must_have_skills.length) {
            tbody.innerHTML = '';
            intake.must_have_skills.forEach(function (row) {
                addSkillRow(tbody, row.skill, row.years, row.rating);
            });
        }

        global.HandbookIntakeForm?.syncConditionalFields?.();
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDuration(seconds) {
        var n = Number(seconds);
        if (!n || n <= 0) return '';
        var mins = Math.floor(n / 60);
        var secs = Math.round(n % 60);
        return mins + 'm ' + secs + 's';
    }

    function initClientCallRecords(form) {
        var selectEl = form.querySelector('#client-call-records');
        var hintEl = form.querySelector('#client-call-records-hint');
        var hiddenPath = form.querySelector('#selected_transcript_path');
        var previewWrap = form.querySelector('#client-call-records-preview');
        var previewMeta = form.querySelector('#client-call-preview-meta');
        var previewText = form.querySelector('#client-call-preview-text');
        var appendCheckbox = form.querySelector('#client-call-append-context');
        var oorwinInput = form.querySelector('#handbook_oorwin_job_id');
        var additionalContext = form.querySelector('#handbook_additional_context');
        var fetchFn = global.apiFetch || global.plutoFetch;
        var loadTimer = null;
        var lastLoadedDetail = null;

        if (!selectEl || !hintEl || !hiddenPath || !fetchFn) return;

        function setHint(message) {
            hintEl.textContent = message || '';
        }

        function clearPreview() {
            lastLoadedDetail = null;
            hiddenPath.value = '';
            if (previewWrap) previewWrap.hidden = true;
            if (previewMeta) previewMeta.textContent = '';
            if (previewText) previewText.textContent = '';
            if (appendCheckbox) appendCheckbox.checked = false;
        }

        function populateSelect(records, message, configured) {
            var current = selectEl.value;
            selectEl.innerHTML = '';
            var defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = '— Select a call transcript (optional) —';
            selectEl.appendChild(defaultOpt);

            (records || []).forEach(function (rec) {
                var opt = document.createElement('option');
                opt.value = rec.object_path;
                opt.textContent = rec.label || rec.basename || rec.object_path;
                selectEl.appendChild(opt);
            });

            if (current) {
                var found = false;
                for (var i = 0; i < selectEl.options.length; i++) {
                    if (selectEl.options[i].value === current) {
                        selectEl.value = current;
                        found = true;
                        break;
                    }
                }
                if (!found) clearPreview();
            }

            if (!configured) {
                selectEl.disabled = true;
                setHint(message || 'Call records unavailable (GCS not configured)');
                return;
            }

            selectEl.disabled = false;
            if (!records || !records.length) {
                setHint(message || 'No call transcripts found yet');
            } else {
                setHint('Optional — link a client call recording from PeopleLogic Recorder.');
            }
        }

        function buildRecordsUrl() {
            var params = new URLSearchParams({ limit: '100' });
            var jobId = (oorwinInput?.value || '').trim();
            if (jobId) params.set('job_id', jobId);
            return '/api/client-call-records?' + params.toString();
        }

        async function loadClientCallRecords() {
            setHint('Loading call transcripts…');
            try {
                var response = await fetchFn(buildRecordsUrl());
                var data = await response.json();
                if (!response.ok) {
                    populateSelect([], data.message || 'Unable to load call transcripts', false);
                    return;
                }
                populateSelect(data.records || [], data.message, data.configured !== false);
            } catch (err) {
                console.warn('client call records load failed', err);
                populateSelect([], 'Unable to load call transcripts', false);
            }
        }

        function scheduleReload() {
            if (loadTimer) clearTimeout(loadTimer);
            loadTimer = setTimeout(loadClientCallRecords, 400);
        }

        function maybeAppendTranscript(detail) {
            if (!appendCheckbox?.checked || !additionalContext || !detail) return;
            var transcript = (detail.transcript || '').trim();
            if (!transcript) return;
            var block =
                '--- Client call transcript (' +
                (detail.recordingFilename || 'recording') +
                ') ---\n' +
                transcript;
            var existing = (additionalContext.value || '').trim();
            if (existing && existing.indexOf(transcript.slice(0, 80)) >= 0) return;
            if (existing) {
                var ok = global.confirm(
                    'Additional Context already has text. Append the full transcript anyway?'
                );
                if (!ok) return;
                additionalContext.value = existing + '\n\n' + block;
            } else {
                additionalContext.value = block;
            }
        }

        async function onRecordSelected() {
            var path = selectEl.value;
            hiddenPath.value = path;
            if (!path) {
                clearPreview();
                return;
            }

            setHint('Loading transcript preview…');
            try {
                var response = await fetchFn(
                    '/api/client-call-records/detail?path=' + encodeURIComponent(path)
                );
                var data = await response.json();
                if (!response.ok || !data.success) {
                    setHint(data.error || 'Unable to load transcript');
                    clearPreview();
                    return;
                }

                var detail = data.transcript || {};
                lastLoadedDetail = detail;
                var ctx = detail.recordingContext || {};
                var meta = detail.metadata || {};
                var client =
                    ctx.clientName || ctx.client || meta.client || ctx.jobCode || detail.jobId || '';
                var contact = ctx.contactName || ctx.clientManager || meta.contact || '';
                var roleTitle = ctx.jobTitle || ctx.roleTitle || meta['job-title'] || '';
                var recordedAt = detail.recordedAt || '';
                var duration = formatDuration(detail.durationSeconds);

                if (previewMeta) {
                    previewMeta.innerHTML =
                        '<strong>' +
                        escapeHtml(client || 'Client call') +
                        '</strong>' +
                        (contact ? ' · ' + escapeHtml(contact) : '') +
                        (roleTitle ? ' · ' + escapeHtml(roleTitle) : '') +
                        (recordedAt ? '<br><span class="text-secondary">' + escapeHtml(recordedAt) : '') +
                        (duration ? ' · ' + escapeHtml(duration) : '') +
                        (recordedAt ? '</span>' : '');
                }
                if (previewText) {
                    var preview = (detail.transcript || '').slice(0, 500);
                    previewText.textContent = preview + (detail.transcript && detail.transcript.length > 500 ? '…' : '');
                }
                if (previewWrap) previewWrap.hidden = false;
                setHint('Transcript linked for handbook generation.');
                maybeAppendTranscript(detail);
            } catch (err) {
                console.warn('transcript detail failed', err);
                setHint('Unable to load transcript');
                clearPreview();
            }
        }

        selectEl.addEventListener('change', onRecordSelected);
        if (appendCheckbox) {
            appendCheckbox.addEventListener('change', function () {
                if (appendCheckbox.checked && lastLoadedDetail) {
                    maybeAppendTranscript(lastLoadedDetail);
                }
            });
        }
        if (oorwinInput) {
            oorwinInput.addEventListener('input', scheduleReload);
            oorwinInput.addEventListener('change', scheduleReload);
        }

        loadClientCallRecords();
    }

    function initHandbookIntakeForm() {
        var form = document.getElementById('handbookGenerationForm');
        if (!form) return;

        var tbody = form.querySelector('#intake-must-have-skills-body');
        var addBtn = form.querySelector('#intake-add-skill-row');
        if (tbody && !tbody.querySelector('tr')) {
            addSkillRow(tbody, '', '', '');
        }
        if (addBtn && tbody) {
            addBtn.addEventListener('click', function () {
                addSkillRow(tbody, '', '', '');
            });
        }

        function syncConditionalFields() {
            var customDays = form.querySelector('#intake_working_days_custom');
            var customToggle = form.querySelector('#intake_working_days_custom_toggle');
            if (customDays && customToggle) {
                customDays.style.display = customToggle.checked ? '' : 'none';
            }
            var shiftTimes = form.querySelector('#intake_shift_times');
            var shiftSpecific = form.querySelector('input[name="intake_shift"][value="specific"]');
            if (shiftTimes && shiftSpecific) {
                shiftTimes.style.display = shiftSpecific.checked ? '' : 'none';
            }
        }

        form.querySelectorAll('input[name="intake_working_days"]').forEach(function (el) {
            el.addEventListener('change', syncConditionalFields);
        });
        form.querySelectorAll('input[name="intake_shift"]').forEach(function (el) {
            el.addEventListener('change', syncConditionalFields);
        });
        syncConditionalFields();
        initClientCallRecords(form);

        global.HandbookIntakeForm = {
            collectHandbookIntakePayload: collectHandbookIntakePayload,
            validateHandbookIntake: validateHandbookIntake,
            populateHandbookIntakeForm: populateHandbookIntakeForm,
            syncConditionalFields: syncConditionalFields,
            resetHandbookIntakeForm: function () {
                var tbody = form.querySelector('#intake-must-have-skills-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    addSkillRow(tbody, '', '', '');
                }
                var callSelect = form.querySelector('#client-call-records');
                var hiddenPath = form.querySelector('#selected_transcript_path');
                var previewWrap = form.querySelector('#client-call-records-preview');
                if (callSelect) callSelect.value = '';
                if (hiddenPath) hiddenPath.value = '';
                if (previewWrap) previewWrap.hidden = true;
                syncConditionalFields();
            },
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHandbookIntakeForm);
    } else {
        initHandbookIntakeForm();
    }
})(typeof window !== 'undefined' ? window : globalThis);
