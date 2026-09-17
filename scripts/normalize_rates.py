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


# Directional bore (DP) restructure - RULING 2026-09-17, rates corrected.
#
# The source sheet priced directional bore as a base unit plus an adder:
#   BM60-(1.25)DP          $10.00/FT  one pipe
#   BM60-(1.25)DPD Dual    $ 2.00/FT  "a second or more ... pulling multiple
#                                      pipes back at one time"
# Billing a 3-pull bore therefore meant three separate transactions and nothing
# in the record stated the pull count. Ruling: expand into one unit per pull
# count, named like the plow units, so the pull count is a FACT of the selected
# pay unit.
#
# The rates are BANDED, not additive - the adder does not compound per pipe:
#   1 pipe        $10.00
#   2 or 3 pipes  $12.00
#   4 or 5 pipes  $14.00
# Stated by the contract owner 2026-09-17. They are listed here explicitly
# rather than computed, because a banded schedule is master data: any formula
# would be a guess about pipes 6 and up that nobody has priced.
DP_PULL_EXPANSION = {
    "BM60-(1.25)DP": {
        "adder_code": "BM60-(1.25)DPD Dual",
        "rates": {1: "10", 2: "12", 3: "12", 4: "14", 5: "14"},
        "code": "BM60({n})(1.25)DP",
        "desc": (
            'Labor to install {word} ({n}) 1.25" conduit bore or road crossing '
            "via the hydraulic bore rig method, pulling all pipes back at one "
            "time. Unit consists of digging entry and exit pits, tamping and "
            "backfilling."
        ),
    },
}

NUMBER_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}


def expand_dp_units(master, exceptions):
    """Replace each base/adder DP pair with one pay unit per pull count."""
    by_code = {e["code"]: e for e in master}

    for base_code, spec in DP_PULL_EXPANSION.items():
        base = by_code.get(base_code)
        adder = by_code.get(spec["adder_code"])
        if base is None or adder is None:
            exceptions.append(
                (base_code, "", "DP expansion skipped: base or adder row missing")
            )
            continue

        expanded = []
        for n, rate in sorted(spec["rates"].items()):
            expanded.append({
                "code": spec["code"].format(n=n),
                "description": spec["desc"].format(n=n, word=NUMBER_WORDS[n]),
                "unit": base["unit"],
                "rate": rate,
            })

        # Splice the new units in where the base unit was, and drop the pair.
        at = master.index(base)
        master[at:at + 1] = expanded
        master.remove(adder)
        bands = ", ".join(f"{n}={r}" for n, r in sorted(spec["rates"].items()))
        exceptions.append(
            (base_code, base["rate"],
             f"EXPANDED into {len(spec['rates'])} pull-count units at banded rates "
             f"({bands}); {spec['adder_code']} @ {adder['rate']} superseded")
        )

    return master, exceptions


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
    master, exceptions = expand_dp_units(master, exceptions)

    (ROOT / "data" / "labor-master.json").write_text(json.dumps(master, indent=1))

    choices = [
        {"label": f"{e['code']} ({e['unit']}) {e['description'][:42]}", "value": e["code"]}
        for e in master
    ]
    (ROOT / "data" / "labor-choices.json").write_text(json.dumps(choices, indent=1))

    # Import-ready rate records. One per pay unit, contractor-wide (no project
    # override), effective 2026-01-01. Rates are snapshotted onto production
    # transactions at selection time and never recalculated from here.
    rate_cols = [
        "rate_id", "contractor_id_snap", "contractor_name_snap",
        "project_id_snap", "project_name_snap", "labor_code", "labor_description",
        "unit", "unit_rate", "effective_date", "expiration_date", "active",
        "supersedes_rate_id", "status", "notes",
    ]
    with (ROOT / "data" / "import" / "contractor-rates-river-city.csv").open(
        "w", newline=""
    ) as fh:
        w = csv.DictWriter(fh, fieldnames=rate_cols)
        w.writeheader()
        for i, e in enumerate(master, start=1):
            w.writerow({
                "rate_id": f"RATE-{i:06d}",
                "contractor_id_snap": "CON-0001",
                "contractor_name_snap": "River City Communications",
                "project_id_snap": "",
                "project_name_snap": "",
                "labor_code": e["code"],
                "labor_description": e["description"],
                "unit": e["unit"],
                "unit_rate": e["rate"],
                "effective_date": "2026-01-01",
                "expiration_date": "",
                "active": "yes",
                "supersedes_rate_id": "",
                "status": "ACTIVE",
                "notes": "Loaded from River_City_Rates.xlsx",
            })

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
