"""Recruitment intake checklist — schema, validation, prompt formatting."""

from __future__ import annotations

import json
from typing import Any

INTAKE_SCHEMA_VERSION = 1


def _clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _clean_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [v.strip() for v in value.split(",") if v.strip()]
    if isinstance(value, list):
        return [_clean_str(v) for v in value if _clean_str(v)]
    return []


def normalize_intake_payload(data: dict | None) -> dict:
    """Merge API `intake` object with legacy flat handbook fields."""
    data = data or {}
    raw = data.get("intake") if isinstance(data.get("intake"), dict) else {}

    intake: dict[str, Any] = {
        "schema_version": INTAKE_SCHEMA_VERSION,
        "req_id": _clean_str(raw.get("req_id") or data.get("oorwin_job_id")),
        "priority": _clean_str(raw.get("priority")).lower() or "med",
        "job_title": _clean_str(raw.get("job_title") or data.get("job_title")),
        "role_type": _clean_list(raw.get("role_type")),
        "job_location": _clean_str(raw.get("job_location")),
        "in_city_location": _clean_str(raw.get("in_city_location")),
        "work_mode": _clean_list(raw.get("work_mode")),
        "working_days": _clean_list(raw.get("working_days")),
        "working_days_custom": _clean_str(raw.get("working_days_custom")),
        "shift": _clean_str(raw.get("shift")) or "ist_general",
        "shift_start": _clean_str(raw.get("shift_start")),
        "shift_end": _clean_str(raw.get("shift_end")),
        "budget_min_lpa": _clean_str(raw.get("budget_min_lpa")),
        "budget_max_lpa": _clean_str(raw.get("budget_max_lpa")),
        "travel_requirement": _clean_list(raw.get("travel_requirement")),
        "experience_years": _clean_list(raw.get("experience_years")),
        "education": _clean_list(raw.get("education")),
        "must_have_skills": _normalize_skills(raw.get("must_have_skills")),
        "good_to_have_skills": _clean_str(raw.get("good_to_have_skills")),
        "notice_period": _clean_list(raw.get("notice_period")),
        "interview_levels": _clean_list(raw.get("interview_levels")),
        "assessments": _clean_list(raw.get("assessments")),
        "interview_process": _clean_str(raw.get("interview_process")),
        "hiring_urgency": _clean_str(raw.get("hiring_urgency")) or "standard",
        "job_description": _clean_str(
            raw.get("job_description") or data.get("job_description")
        ),
        "sourcing_notes": _clean_str(raw.get("sourcing_notes")),
        "additional_context": _clean_str(
            raw.get("additional_context") or data.get("additional_context")
        ),
        "am_name": _clean_str(raw.get("am_name")),
        "am_email": _clean_str(raw.get("am_email")),
        "am_phone": _clean_str(raw.get("am_phone")),
        "date_submitted": _clean_str(raw.get("date_submitted")),
        "target_start_date": _clean_str(raw.get("target_start_date")),
        "approved_by": _clean_str(raw.get("approved_by")),
    }

    if not intake["req_id"]:
        intake["req_id"] = _clean_str(data.get("oorwin_job_id"))

    return intake


def _normalize_skills(raw: Any) -> list[dict[str, str]]:
    if not raw:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return [{"skill": raw, "years": "", "rating": ""}]
    if not isinstance(raw, list):
        return []
    out = []
    for row in raw:
        if isinstance(row, dict):
            skill = _clean_str(row.get("skill"))
            if skill:
                out.append(
                    {
                        "skill": skill,
                        "years": _clean_str(row.get("years")),
                        "rating": _clean_str(row.get("rating")),
                    }
                )
        elif _clean_str(row):
            out.append({"skill": _clean_str(row), "years": "", "rating": ""})
    return out


def validate_intake(intake: dict) -> list[str]:
    errors: list[str] = []
    if not intake.get("job_title"):
        errors.append("Position title is required")
    if not intake.get("job_location"):
        errors.append("Job location is required")
    if not intake.get("role_type"):
        errors.append("Select at least one role type")
    if not intake.get("budget_min_lpa") or not intake.get("budget_max_lpa"):
        errors.append("Budget (min and max CTC in LPA) is required")
    if not intake.get("experience_years"):
        errors.append("Select years of experience")
    if not intake.get("must_have_skills"):
        errors.append("Add at least one must-have skill")
    if not intake.get("job_description"):
        errors.append("Job description is required")
    if not intake.get("interview_levels"):
        errors.append("Select interview levels")
    if not intake.get("am_name"):
        errors.append("AM name / SPOC is required")
    if not intake.get("am_email"):
        errors.append("AM email is required")
    if not intake.get("am_phone"):
        errors.append("AM phone is required")
    if not intake.get("date_submitted"):
        errors.append("Date submitted is required")
    return errors


def intake_to_json(intake: dict) -> str:
    return json.dumps(intake, ensure_ascii=False)


def intake_from_json(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return None


_LABELS = {
    "priority": {"high": "High", "med": "Medium", "low": "Low"},
    "role_type": {
        "individual_contributor": "Individual Contributor",
        "people_manager": "People Manager",
        "player_coach": "Player-Coach",
    },
    "work_mode": {"on_site": "On-site", "hybrid": "Hybrid", "remote": "Remote"},
    "working_days": {
        "mon_fri": "Mon – Fri",
        "mon_sat": "Mon – Sat",
        "five_day_flexible": "5-day flexible",
        "custom": "Custom",
    },
    "travel_requirement": {
        "none": "None",
        "occasional": "Occasional",
        "frequent": "Frequent",
        "pan_india": "Pan-India",
        "international": "International",
    },
    "experience_years": {
        "0-2": "0–2 yrs",
        "2-4": "2–4 yrs",
        "4-6": "4–6 yrs",
        "6-8": "6–8 yrs",
        "8-10": "8–10 yrs",
        "10+": "10+ yrs",
    },
    "education": {
        "any_graduate": "Any Graduate",
        "btech_be": "B.Tech / B.E",
        "mba": "MBA",
        "mca": "MCA",
        "ca_cma": "CA / CMA",
        "no_preference": "No preference",
    },
    "notice_period": {
        "immediate": "Immediate",
        "15": "15 days",
        "30": "30 days",
        "60": "60 days",
        "no_preference": "No preference",
    },
    "interview_levels": {
        "1": "1 Round",
        "2": "2 Rounds",
        "3": "3 Rounds",
        "4plus": "4+ Rounds",
    },
    "assessments": {
        "written": "Written",
        "cba": "CBA",
        "coding": "Coding",
        "psychometric": "Psychometric",
        "language": "Language",
    },
    "hiring_urgency": {
        "standard": "Standard (30–45d)",
        "priority": "Priority (15–30d)",
        "critical": "Critical (<15d)",
    },
}


def _label(group: str, key: str) -> str:
    return _LABELS.get(group, {}).get(key, key.replace("_", " ").title())


def _fmt_list(group: str, keys: list[str]) -> str:
    if not keys:
        return "Not specified"
    return ", ".join(_label(group, k) for k in keys)


def format_intake_for_prompt(intake: dict) -> str:
    """Structured AM handoff block for the LLM."""
    skills_lines = []
    for i, row in enumerate(intake.get("must_have_skills") or [], 1):
        skills_lines.append(
            f"  {i}. {row['skill']}"
            + (f" | {row['years']} yrs" if row.get("years") else "")
            + (f" | rating {row['rating']}/5" if row.get("rating") else "")
        )
    skills_block = "\n".join(skills_lines) if skills_lines else "  (none listed)"

    shift = (
        "IST General"
        if intake.get("shift") == "ist_general"
        else f"Specific: {intake.get('shift_start', '?')} – {intake.get('shift_end', '?')}"
    )

    budget = f"{intake.get('budget_min_lpa', '?')} – {intake.get('budget_max_lpa', '?')} LPA"

    lines = [
        "## RECRUITMENT INTAKE (AM → Sourcing handoff — treat as authoritative)",
        f"**Req ID:** {intake.get('req_id') or 'Not specified'}",
        f"**Priority:** {_label('priority', intake.get('priority', 'med'))}",
        "",
        "### Role basics",
        f"- **Position title:** {intake.get('job_title')}",
        f"- **Role type:** {_fmt_list('role_type', intake.get('role_type', []))}",
        f"- **Job location:** {intake.get('job_location')}",
        f"- **In-city location:** {intake.get('in_city_location') or 'N/A'}",
        f"- **Work mode:** {_fmt_list('work_mode', intake.get('work_mode', []))}",
        f"- **Working days:** {_fmt_list('working_days', intake.get('working_days', []))}"
        + (f" ({intake.get('working_days_custom')})" if intake.get("working_days_custom") else ""),
        f"- **Shift:** {shift}",
        "",
        "### Compensation & employment",
        f"- **Budget (CTC):** {budget}",
        f"- **Travel:** {_fmt_list('travel_requirement', intake.get('travel_requirement', []))}",
        "",
        "### Candidate profile",
        f"- **Experience:** {_fmt_list('experience_years', intake.get('experience_years', []))}",
        f"- **Education:** {_fmt_list('education', intake.get('education', []))}",
        f"- **Notice period:** {_fmt_list('notice_period', intake.get('notice_period', []))}",
        "**Must-have skills:**",
        skills_block,
        f"**Good-to-have skills:** {intake.get('good_to_have_skills') or 'None specified'}",
        "",
        "### Interview process",
        f"- **Levels:** {_fmt_list('interview_levels', intake.get('interview_levels', []))}",
        f"- **Assessments:** {_fmt_list('assessments', intake.get('assessments', []))}",
        f"- **Process narrative:** {intake.get('interview_process') or 'Not specified'}",
        f"- **Hiring urgency:** {_label('hiring_urgency', intake.get('hiring_urgency', 'standard'))}",
        "",
        "### Sourcing notes (mandate)",
        intake.get("sourcing_notes") or "None specified",
        "",
        "### Sign-off",
        f"- **AM / SPOC:** {intake.get('am_name')} | {intake.get('am_email')} | {intake.get('am_phone')}",
        f"- **Date submitted:** {intake.get('date_submitted')}",
        f"- **Target start:** {intake.get('target_start_date') or 'Not specified'}",
        f"- **Approved by:** {intake.get('approved_by') or 'Not specified'}",
    ]

    if intake.get("additional_context"):
        lines.extend(["", "### Additional context", intake["additional_context"]])

    lines.extend(
        [
            "",
            "**Rules:** If JD text conflicts with intake, prefer intake and note the conflict in Red Flags.",
        ]
    )
    return "\n".join(lines)


def build_recruiter_handbook_prompt(
    job_description: str,
    additional_context: str = "",
    intake: dict | None = None,
) -> str:
    """Canonical recruiter-handbook prompt (intake-aware, expanded sections)."""
    intake_block = ""
    if intake:
        intake_block = format_intake_for_prompt(intake)
        job_description = intake.get("job_description") or job_description
        additional_context = intake.get("additional_context") or additional_context
    elif additional_context:
        intake_block = f"**Additional Context:**\n{additional_context}"

    intake_section = f"\n\n---\n\n{intake_block}\n\n---\n\n" if intake_block else ""

    return f"""You are an expert recruitment specialist creating a Recruiter Playbook & Handbook from an AM intake handoff and job description. Use EVERY field in the intake block — budget, location, notice period, interview plan, sourcing notes, skills matrix, urgency, and SPOC details must shape screening, sourcing, Boolean strings, red flags, and the sales pitch. Do not invent constraints that contradict the intake.

{intake_section}

**Job Description (full text):**
{job_description}

---

**CRITICAL ORDER — follow this exact sequence (NO duplicates, NO extra top-level sections):**

1. **Title**: Start with 📖 **Recruiter Playbook & Handbook: [Role Title]**

2. **Mini Table of Contents**: Markdown links to each H2 section below (one line per section).

3. **Introduction**: ONE paragraph — handbook equips recruiters with intake-aligned screening, sourcing, interview prep, comp/notice guardrails, and candidate pitch. Mention req priority and hiring urgency if provided.

4. Structure content as numbered H2 sections (use emojis sparingly in headers):

   **0. Intake Snapshot** — 5–7 bullet recap: priority, location/work mode, budget band, notice, urgency, must-have skills top 3, interview rounds. Pull from intake only.

   **1. Role Logistics & Work Model** — location, hybrid/remote/on-site, shift, travel, working days; recruiter implications for sourcing geography and candidate screening.

   **2. Compensation, Notice & Eligibility Guardrails** — CTC band, notice-period filter, education/experience bands; what to confirm on first call; what is a hard reject vs negotiable.

   **3. Job Summary** — 4–5 sentences plain prose: core objective, must-have depth, client context from JD + intake.

   **4. Primary Sourcing Parameters (Must-Have)** — GFM table: | # | Skill / Experience | Recruiter Cue | Why It Matters | — 6–10 rows from must-have skills table + JD.

   **5. Screening Framework** — Sections A–H (Role logistics, Comp/notice, Must-have skills, Domain, Behavioral, Process fit, Client-specific from sourcing notes, Sign-off probes) with 1–3 bullet questions each.

   **6. Interview & Assessment Plan** — mirror intake interview levels, assessments, and process narrative; stage-by-stage what recruiter should prep candidate for.

   **7. Target Talent Pools** — Likely Companies (4–8), Likely Titles (3–5), **Platform Strategies** subsection with exactly:
        - **LinkedIn X-ray string:** one line in a fenced ```text``` code block (site:linkedin.com/in …)
        - **GitHub search strings:** TWO lines in ```text``` blocks (recruiter-grade sourcing):
          1) **Repos (recommended):** repository search — topic/framework first, then repo qualifiers. Example syntax: spring-boot language:Java stars:>100 location:bengaluru → URL must use type=repositories (NOT type=users for language:/stars:).
          2) **Users (supplementary):** profile search — keyword text + location: + followers:>10. Example: spring boot location:bengaluru followers:>10 → type=users.
          Expand frameworks in boolean style where useful: ("spring boot" OR springboot OR "spring-boot"). Note: GitHub is best for OSS-heavy roles; pair with LinkedIn X-Ray for enterprise pools.
        - **Adjacency:** 3 bullet lines
      Then **Boolean Samples (≤ 200 chars each)** as a numbered list (1. 2. 3.) with each query in backticks or inline code.

   **8. Sourcing Mandate & Channel Strategy** — expand sourcing notes: target companies, channels, diversity mandates, avoid list; actionable recruiter checklist.

   **9. Red Flags to Watch** — 5–8 bullets including intake/JD conflicts, over-budget, notice mismatch, travel/location mismatch.

   **10. Recruiter Checklist (Pre-call)** — 5–7 bullets tied to urgency and sign-off fields.

   **11. Recruiter Sales Pitch (to candidates)** — ✨ **Why this role?** then 5–7 bullets using comp band, work mode, and growth hooks; closing tagline.

   **12. Overqualification / Flight Risk Assessment** — experience vs band, title gap, comp, notice; when to proceed; 2–3 screening questions.

   **13. Hiring Timeline & Priority Playbook** — map hiring urgency to weekly sourcing cadence, stakeholder touchpoints, AM SPOC ({intake.get('am_name') if intake else 'SPOC'} if known).

   End with ✅ one line: handbook is intake-aligned; verify live req status with AM before outreach.

**Style:** Professional, concise, actionable. Markdown only; no outer code fences. Prefer intake over JD when they conflict.

Generate the complete Recruiter Playbook & Handbook now:"""
