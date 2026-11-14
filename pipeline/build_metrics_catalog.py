#!/usr/bin/env python3
"""Build src/data/metrics-catalog.json from the Draft 3 metrics spreadsheet.

Source of truth: Google Sheet "Draft 3" tab (gid=380290889)
https://docs.google.com/spreadsheets/d/151XYyyy9HRlFYEFu9zvzud_sK3iOMXjHK_wNixa7Cr8/edit?gid=380290889

Usage:
    python3 pipeline/build_metrics_catalog.py            # use the committed snapshot
    python3 pipeline/build_metrics_catalog.py --refresh  # re-download the sheet first

Standard library only, so it runs without a virtualenv.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "data" / "source" / "metrics-draft3.csv"
OUT = ROOT / "src" / "data" / "metrics-catalog.json"
SHEET_ID = "151XYyyy9HRlFYEFu9zvzud_sK3iOMXjHK_wNixa7Cr8"
GID = "380290889"
EXPORT_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}"

EXPECTED_HEADER = [
    "Category",
    "Scientific information / variable",
    "What it helps users understand",
    "Definition",
    "Unit / datatype",
    "Significance to mission",
    "Dependencies",
    "Variable role",
    "Public/Enthusiast view",
    "Educator view",
    "Mission planner view",
    "Primary source / basis",
    "Important caveats",
]

# Stable ids for the 13 categories (order = display order on the Site Details page).
CATEGORY_IDS = {
    "Overall decision metrics": "overall",
    "Sun geometry, illumination & energy": "sun",
    "Earth geometry, DTE comms & relay": "earth",
    "Spatial context & geometry": "spatial",
    "Terrain & physical landing surface": "terrain",
    "Regolith, geotechnical, thermal & local environment": "regolith",
    "Landing, descent & touchdown hazards": "landing",
    "Launch, orbital transfer & descent trajectory": "trajectory",
    "Science value, geology & volatiles": "science",
    "Surface mission logistics & infrastructure": "logistics",
    "Rover traversability & field ops": "rover",
    "Space weather, impact & rare-event hazards": "space-weather",
    "Mission heritage, nearby activity & historical evidence": "heritage",
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def split_category(raw: str) -> tuple[str, str]:
    """'☀️ Sun geometry, ...' -> ('☀️', 'Sun geometry, ...')."""
    raw = raw.strip()
    first_alpha = next((i for i, ch in enumerate(raw) if ch.isascii() and ch.isalpha()), 0)
    return raw[:first_alpha].strip(), raw[first_alpha:].strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download the sheet into the snapshot")
    args = ap.parse_args()

    if args.refresh:
        print(f"Downloading {EXPORT_URL}")
        with urllib.request.urlopen(EXPORT_URL) as resp:  # noqa: S310 (fixed, trusted URL)
            SNAPSHOT.write_bytes(resp.read())

    rows = list(csv.reader(SNAPSHOT.open(encoding="utf-8")))
    header, data = rows[0], rows[1:]
    if header != EXPECTED_HEADER:
        print("Header changed in the sheet. Update EXPECTED_HEADER and the TS types.", file=sys.stderr)
        print(header, file=sys.stderr)
        return 1

    categories: dict[str, dict] = {}
    metrics: list[dict] = []
    seen_ids: set[str] = set()

    for r in data:
        if not any(c.strip() for c in r):
            continue
        emoji, label = split_category(r[0])
        cat_id = CATEGORY_IDS.get(label)
        if cat_id is None:
            print(f"Unknown category: {r[0]!r}. Add it to CATEGORY_IDS.", file=sys.stderr)
            return 1
        cat = categories.setdefault(
            cat_id, {"id": cat_id, "emoji": emoji, "label": label, "metricIds": []}
        )

        mid = f"{cat_id}.{slugify(r[1])}"
        n = 2
        while mid in seen_ids:  # keep ids unique if a name repeats inside a category
            mid = f"{cat_id}.{slugify(r[1])}-{n}"
            n += 1
        seen_ids.add(mid)
        cat["metricIds"].append(mid)

        metrics.append(
            {
                "id": mid,
                "categoryId": cat_id,
                "name": r[1].strip(),
                "question": r[2].strip(),
                "definition": r[3].strip(),
                "unit": r[4].strip(),
                "significance": r[5].strip(),
                "dependencies": r[6].strip(),
                "role": r[7].strip(),
                "views": {
                    "enthusiast": r[8].strip(),
                    "educator": r[9].strip(),
                    "planner": r[10].strip(),
                },
                "source": r[11].strip(),
                "caveats": r[12].strip() or None,
            }
        )

    ordered = [categories[c] for c in CATEGORY_IDS.values() if c in categories]
    catalog = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "sheet": f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit?gid={GID}",
            "tab": "Draft 3",
            "rows": len(metrics),
            "columns": len(header),
        },
        "categories": ordered,
        "metrics": metrics,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(metrics)} metrics in {len(ordered)} categories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
