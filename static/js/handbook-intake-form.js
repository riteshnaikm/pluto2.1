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
            am_name: (form.querySelector('#intake_am_name')?.value || '').trim(),
            am_email: (form.querySelector('#intake_am_email')?.value || '').trim(),
            am_phone: (form.querySelector('#intake_am_phone')?.value || '').trim(),
            date_submitted: (form.querySelector('#intake_date_submitted')?.value || '').trim(),
            target_start_date: (form.querySelector('#intake_target_start')?.value || '').trim(),
            approved_by: (form.querySelector('#intake_approved_by')?.value || '').trim(),
        };

        return {
            job_title: intake.job_title,
            job_description: intake.job_description,
            additional_context: intake.additional_context,
            oorwin_job_id: reqId,
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
        if (!i.am_name) return { ok: false, message: 'AM name / SPOC is required.' };
        if (!i.am_email) return { ok: false, message: 'AM email is required.' };
        if (!i.am_phone) return { ok: false, message: 'AM phone is required.' };
        if (!i.date_submitted) return { ok: false, message: 'Date submitted is required.' };
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
        set('intake_am_name', intake.am_name);
        set('intake_am_email', intake.am_email);
        set('intake_am_phone', intake.am_phone);
        set('intake_date_submitted', intake.date_submitted);
        set('intake_target_start', intake.target_start_date);
        set('intake_approved_by', intake.approved_by);
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

        var dateEl = form.querySelector('#intake_date_submitted');
        if (dateEl && !dateEl.value) {
            dateEl.value = new Date().toISOString().slice(0, 10);
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
                var dateEl = form.querySelector('#intake_date_submitted');
                if (dateEl) {
                    dateEl.value = new Date().toISOString().slice(0, 10);
                }
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
