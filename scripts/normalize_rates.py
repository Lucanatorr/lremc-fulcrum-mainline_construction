#!/usr/bin/env python3
"""
Normalize the River City contractor rate sheet into a loadable labor-code master.

Input   data/river-city-rates-extracted.csv   (columns: idx, code, description, unit, rate, qty)
Output  data/labor-master.json                (one object per pay unit)
        data/labor-choices.json               (Fulcrum choice-list payload)
        data/labor-exceptions.csv             (rows deliberately not loaded)

The source workbook is OCR-damaged: 77 of 149 codes carry stray whitespace,
newlines or U+FFFD replacement characters, and several descriptions are shifted
one row relative to their code. Normalization here is deliberately conservative:
whitespace and control characters are cleaned, but no code is invented and no
rate is inferred. Anything ambiguous lands in labor-exceptions.csv for a human.

Business rulings applied (2026-09-16):
  * "Heavy metro adder" (3 rows)  - excluded entirely.
  * HO-1TL                        - $9 is authoritative; the $7 row is dropped.
  * bare HO-1 @ $42               - dropped; HO-1 (x-y) bands price splicing.
  * BM60(1.25)DP SDR 7 Rail Road  - split into two distinct pay units, since one
                                    code carried two rates ($12 for 1.25",
                                    $16 for 2"). See RAILROAD_SPLIT below.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "river-city-rates-extracted.csv"

# Source unit strings -> normalized unit of measure.
# HR and EVENT are time-and-materials units: they must never be aggregated into
# physical production totals alongside FT / EA / SPLICE / SF.
UNIT_MAP = {
    "Per Foot": "FT",
    "Each": "EA",
    "EACH": "EA",
    "Per Hour": "HR",
    "Per Splice": "SPLICE",
    "Ft2": "SF",
    "Per Event": "EVENT",
}

# One source code carried two rates for two different conduit diameters.
# Ruling: create one pay unit per diameter rather than one ambiguous code.
# NOTE: the source code string reads "SDR 7" while both descriptions read
# "SDR 11". That discrepancy is in the contract document and is unresolved.
RAILROAD_SPLIT = {
    "12": {
        "code": "BM60(1.25)DP SDR Rail Road",
        "desc": 'Labor to install a SDR 11 1.25" conduit railroad bore via the hydraulic bore method.',
    },
    "16": {
        "code": "BM60(2)DP SDR Rail Road",
        "desc": 'Labor to install a SDR 11 2" conduit railroad bore via the hydraulic bore method.',
    },
}


def clean(s: str) -> str:
    """Strip OCR damage without altering meaning."""
    s = s.replace("�", " ").replace("\n", " ").replace("\r", " ")
    return re.sub(r"\s+", " ", s).strip()


def load_rows():
    with SRC.open(newline="") as fh:
        rows = list(csv.reader(fh))
    return [r for r in rows[1:] if len(r) >= 5 and (r[1].strip() or r[2].strip())]


def normalize():
    out, exceptions, seen = [], [], {}

    for row in load_rows():
        code, desc = clean(row[1]), clean(row[2])
        unit_raw, rate = row[3].strip(), row[4].strip()
        if not code:
            continue

        if code.lower().startswith("heavy"):
            exceptions.append((code, rate, "RULING: Heavy metro adder excluded"))
            continue

        if "Rail" in code:
            split = RAILROAD_SPLIT.get(rate)
            if not split:
                exceptions.append((code, rate, "Railroad row with an unexpected rate"))
                continue
            code, desc = split["code"], split["desc"]

        if code == "HO-1" and rate == "42":
            exceptions.append((code, rate, "RULING: superseded by HO-1 (x-y) bands"))
            continue

        if code == "HO-1TL" and rate == "7":
            exceptions.append((code, rate, "RULING: HO-1TL is $9"))
            continue

        unit = UNIT_MAP.get(unit_raw)
        if unit is None:
            exceptions.append((code, rate, f"Unmapped unit {unit_raw!r}"))
            continue

        if code in seen:
            prior = seen[code]
            if prior["rate"] != rate or prior["unit"] != unit:
                exceptions.append(
                    (code, rate, f"AMBIGUOUS: conflicts with existing rate {prior['rate']}")
                )
                continue
            # Same code, same price, differing wording: keep both descriptions.
            prior["description"] += " / " + desc
            continue

        entry = {"code": code, "description": desc, "unit": unit, "rate": rate}
        seen[code] = entry
        out.append(entry)

    return out, exceptions


def main():
    master, exceptions = normalize()

    (ROOT / "data" / "labor-master.json").write_text(json.dumps(master, indent=1))

    choices = [
        {"label": f"{e['code']} ({e['unit']}) {e['description'][:42]}", "value": e["code"]}
        for e in master
    ]
    (ROOT / "data" / "labor-choices.json").write_text(json.dumps(choices, indent=1))

    with (ROOT / "data" / "labor-exceptions.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["code", "rate", "reason"])
        w.writerows(exceptions)

    codes = [e["code"] for e in master]
    assert len(set(codes)) == len(codes), "duplicate labor codes survived normalization"

    print(f"{len(master)} pay units loadable, {len(exceptions)} excluded")
    for e in exceptions:
        print("  EXCLUDED", e)
    return 0


if __name__ == "__main__":
    sys.exit(main())
