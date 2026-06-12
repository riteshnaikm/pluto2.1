"""Check how VoxPro ``dur`` correlates with recording file availability."""

import requests
from datetime import datetime, timedelta

BASE = "http://office.peoplelogic.in"
PHONE = "9599015158"


def dur_has_value(dur) -> bool:
    s = str(dur).strip() if dur is not None else ""
    if not s:
        return False
    try:
        float(s)
        return True
    except ValueError:
        return False


def head_wav(c) -> tuple[str, int | None]:
    loc, fn = c.get("rec_location"), c.get("rec_fname")
    if not loc or not fn:
        return "no_fname", None
    url = f"{BASE}/{loc.strip('/')}/{fn}.wav"
    r = requests.head(url, timeout=15)
    return "ok" if r.status_code == 200 else f"http_{r.status_code}", r.status_code


def main():
    to_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    from_dt = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d %H:%M:%S")
    calls = requests.request(
        "GET",
        f"{BASE}/Voxpro/api/log_pull",
        json={"from": from_dt, "to": to_dt, "phone": PHONE},
        timeout=60,
    ).json()

    print("dur        | status         | dur_rule | wav HEAD  | note")
    print("-" * 72)
    for c in sorted(calls, key=lambda x: x.get("datetime", "")):
        dur = c.get("dur")
        rule = dur_has_value(dur)
        wav, code = head_wav(c)
        note = ""
        if rule and wav != "ok":
            note = "dur set but file missing (retention?)"
        if not rule and wav == "ok":
            note = "EXCEPTION: file exists without dur"
        print(
            f"{str(dur)!r:10} | {c.get('status', ''):14} | "
            f"{'YES' if rule else 'NO ':3}      | {wav:9} | {note}"
        )


if __name__ == "__main__":
    main()
