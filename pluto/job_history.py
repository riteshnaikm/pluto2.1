"""Bulk queries for job-centric history (avoids N+1 per job)."""

from collections import defaultdict

from pluto.uploads import candidate_display_name, display_upload_filename


def fetch_job_centric_history(cursor, accessible_emails):
  """
  Returns list of job dicts matching the legacy get_job_centric_history shape.
  """
  if not accessible_emails:
    return []

  placeholders = ",".join(["?"] * len(accessible_emails))
  user_filter = f"(user_email IN ({placeholders}) OR user_email IS NULL)"
  params_base = tuple(accessible_emails)

  cursor.execute(
    f"""
    SELECT oorwin_job_id, MAX(ts) AS last_activity
    FROM (
      SELECT oorwin_job_id, timestamp AS ts FROM evaluations
      WHERE oorwin_job_id IS NOT NULL AND oorwin_job_id != ''
        AND {user_filter}
      UNION ALL
      SELECT oorwin_job_id, timestamp AS ts FROM recruiter_handbooks
      WHERE oorwin_job_id IS NOT NULL AND oorwin_job_id != ''
        AND {user_filter}
    )
    GROUP BY oorwin_job_id
    ORDER BY last_activity DESC
    """,
    params_base + params_base,
  )
  job_ids = [row[0] for row in cursor.fetchall()]
  if not job_ids:
    return []

  job_ph = ",".join(["?"] * len(job_ids))

  # Handbooks per job
  cursor.execute(
    f"""
    SELECT oorwin_job_id, job_title, user_email, timestamp
    FROM recruiter_handbooks
    WHERE oorwin_job_id IN ({job_ph}) AND {user_filter}
    ORDER BY timestamp DESC
    """,
    tuple(job_ids) + params_base,
  )
  hb_rows = cursor.fetchall()

  # Evaluations per job
  cursor.execute(
    f"""
    SELECT oorwin_job_id, job_title, filename, timestamp, match_percentage, user_email,
           evaluation_mode, batch_group_id, id
    FROM evaluations
    WHERE oorwin_job_id IN ({job_ph}) AND {user_filter}
    ORDER BY timestamp DESC
    """,
    tuple(job_ids) + params_base,
  )
  eval_rows = cursor.fetchall()

  # User names for all emails seen
  emails = set()
  for row in hb_rows:
    if row[2]:
      emails.add(row[2])
  for row in eval_rows:
    if row[5]:
      emails.add(row[5])

  name_by_email = {}
  if emails:
    eph = ",".join(["?"] * len(emails))
    cursor.execute(
      f"SELECT email, name FROM users WHERE email IN ({eph})",
      tuple(emails),
    )
    for email, name in cursor.fetchall():
      name_by_email[email] = name or email

  hb_by_job = defaultdict(list)
  titles_hb = {}
  for jid, title, email, ts in hb_rows:
    hb_by_job[jid].append((email, ts))
    if title and jid not in titles_hb:
      titles_hb[jid] = title

  eval_by_job = defaultdict(list)
  titles_ev = {}
  for jid, title, filename, ts, match_pct, email, eval_mode, batch_gid, eval_id in eval_rows:
    eval_by_job[jid].append((filename, ts, match_pct, email, eval_mode, batch_gid, eval_id))
    if title and jid not in titles_ev:
      titles_ev[jid] = title

  result = []
  for job_id in job_ids:
    job_title = titles_hb.get(job_id) or titles_ev.get(job_id) or "N/A"

    hb_list = hb_by_job.get(job_id, [])
    handbooks_count = len(hb_list)
    hb_generated_by = []
    seen_hb = set()
    for email, _ts in hb_list:
      if email and email not in seen_hb:
        seen_hb.add(email)
        hb_generated_by.append(
          {"email": email, "name": name_by_email.get(email, email)}
        )

    evaluations = eval_by_job.get(job_id, [])
    evaluations_count = len(evaluations)
    resume_list = []
    res_evaluated_by = []
    for filename, ts, match_pct, email, eval_mode, batch_gid, eval_id in evaluations:
      evaluator_name = name_by_email.get(email, email) if email else None
      mode = (eval_mode or "single").strip().lower()
      resume_list.append(
        {
          "filename": filename,
          "display_filename": display_upload_filename(filename),
          "candidate_name": candidate_display_name(filename),
          "timestamp": ts,
          "match_percentage": match_pct,
          "evaluator_email": email,
          "evaluator_name": evaluator_name,
          "evaluation_mode": mode,
          "batch_group_id": batch_gid,
          "evaluation_id": eval_id,
        }
      )
      res_evaluated_by.append(
        {
          "email": email,
          "name": evaluator_name or email or "Unknown",
        }
      )

    all_ts = [t for _, t in hb_list] + [e[1] for e in evaluations]
    first_created = min(all_ts) if all_ts else None
    last_activity = max(all_ts) if all_ts else None

    result.append(
      {
        "job_id": job_id,
        "job_title": job_title,
        "handbooks_count": handbooks_count,
        "hb_generated_by": hb_generated_by,
        "evaluations_count": evaluations_count,
        "resume_list": resume_list,
        "res_evaluated_by": res_evaluated_by,
        "first_created": first_created,
        "last_activity": last_activity,
      }
    )

  return result
