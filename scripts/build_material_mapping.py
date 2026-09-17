#!/usr/bin/env python3
"""
Build the material master and the labor -> material mapping from observed
consumption.

Input   data/source/material-observations.py   two projects' consumption + catalogue
        data/labor-master.json                 the 146 pay units

Output  data/import/material-master.csv        one row per stock item
        data/import/labor-material-mapping-proposed.csv
        data/material-mapping-conflicts.csv    where the two projects disagree

METHOD. A ratio is item quantity divided by the eligible production quantity
for that labor unit. A ratio observed in BOTH projects, agreeing within 5%, is
marked CONFIRMED. A ratio seen in only one project is SINGLE SOURCE and needs a
human ruling. Where the two projects name different items for the same labor
unit, the mapping is a CONFLICT and is not auto-approved - guessing there would
put the wrong part number on a purchase order.

Nothing here invents a ratio. Every number traces to an observation or to a
rule stated in a ruling.
"""

import csv
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

spec = importlib.util.spec_from_file_location(
    "observations", ROOT / "data" / "source" / "material-observations.py"
)
OBS = importlib.util.module_from_spec(spec)
spec.loader.exec_module(OBS)

CATALOGUE = dict(OBS.CATALOGUE)
CATALOGUE.update(OBS.CATALOGUE_EXTRA)

RATIO_TOLERANCE = 0.05

# ---------------------------------------------------------------------------
# RULING 2026-09-17 - conduit pull count and material consumption
#
#   1.25"  bundled multi-duct SKUs exist (1-, 2- and 3-PULL). An n-pull run
#          consumes the n-PULL SKU at 1 FT per production FT.
#   2", 4" always a single-duct pipe. There is no bundled 2" or 4" product, so
#          an n-pull run consumes n FT of the single-pipe SKU per production FT.
#
# Conduit also carries a 10% waste factor, per the "DUCT PLUS 10% WASTE" block
# in the source data. Waste is a separate column: installed quantity stays a
# clean measurement, and only the purchasing number is grossed up.
# ---------------------------------------------------------------------------
CONDUIT_SIZES_IN_SCOPE = ["1.25", "2", "4"]
CONDUIT_WASTE_FACTOR = "1.10"

BUNDLED_CONDUIT_SKU = {
    ("1.25", 1): "114-11-O-8000",
    ("1.25", 2): "114-11-2",
    ("1.25", 3): "114-11-3-OGB-T-",
}
SINGLE_PIPE_SKU = {
    "4": "#RM-4-11-O-750",
}

# Transcription variants in the consumption data that name a real pay unit.
# These are spelling/spacing differences, NOT business decisions: each maps a
# label to the pay unit the rate sheet actually carries.
LABOR_CODE_ALIASES = {
    "HO-1 (73-144)":   "HO-1 (73 -144)",   # rate sheet has a stray space
    "BDO SC288":       "BDO-SC288",
    "BDO-432":         "BDO-SC432",
    "HAFOx-33":        "HAFOx",            # -33 is a project suffix, not a unit
    "HBFOx-59":        "HBFOx",
    "AFO.SL STRAND":   "AFO SL Strand",
    "RTD":             "AFO.RTD",
    # The aerial "FOC" groupings are AFO.SL production split by fiber count.
    # The pay unit is AFO.SL; the fiber count belongs to the cable, not the unit.
    "AFO SL 48FOC":    "AFO.SL",
    "AFO SL 72FOC":    "AFO.SL",
    "AFO SL 144FOC":   "AFO.SL",
    "AFO SL 288FOC":   "AFO.SL",
}

CATEGORY_RULES = [
    (r"CONDUIT|MAXCELL|PVC|stick pipe|Coupler|Conduit coupling|90 Degree", "Conduit"),
    (r"RIBBON|ACCUROLL|PRYSMIAN|Loose Tube|SUPERIOR ESSEX|CAT 6|FIBER ARMORED", "Fiber Cable"),
    (r"VAULT|HANDHOLE|SHIELD VAULT|DURALITE|PEDESTRIAN DROP", "Vault-Handhole"),
    (r"PEDESTAL|CABINET|FDH|FIELDSMART", "Pedestal-Cabinet"),
    (r"COYOTE|SPLICE TRAY|SPLICE BLOCK|Heat shrink|PROTECTION SLEEVE|GRIP TRAY|POUR-IN-PLACE", "Splice"),
    (r"SPLITTER|HST|PORT HST|OPTI TAP|OIM |E7-2", "Splitter-MST"),
    (r"STRAND|LASH WIRE|GUY|ANCHOR|Suspension clamp|Thimble|Bolt|washer|Nut square|SUPPORT TIE|DRIVE HOOK|RISER|Riser Guard|U-Guard|Pole band|BANDING|MOUNTING BOLT|POLE MOUNT|STRAND SPLICE|LAG SCREW|Cable Strap|LOCKING HEADS|CABLE TIES", "Aerial Hardware"),
    (r"GROUND ROD|Ground Wire|copper clad|SPLIT BOLT|WEAVER|Clamp-ground|MORAY SHIELD", "Grounding"),
    (r"MARKER|TONE TAPE|CAUTION TAPE|DITCH TAPE|CODING TAPE|PULL TAPE|Tape, Super", "Marker"),
]

# Items consumed by the foot. Checked after NOT_FT so that a ribbon SLEEVE (a
# piece) is not mistaken for ribbon CABLE (a length).
NOT_FT = r"SLEEVE|TRAY|GRIP TRAY|SPLICE BLOCK|BANDING BOLT|HST|STUB"
FT_RULES = (r"CONDUIT|RIBBON|ACCUROLL|PRYSMIAN|Loose Tube|SUPERIOR ESSEX|STRAND|"
            r"LASH WIRE|TONE TAPE|PULL TAPE|CODING TAPE|Coding tape|DITCH TAPE|"
            r"CAUTION TAPE|Ground Wire|copper clad|MAXCELL|CAT 6|FIBER ARMORED|"
            r"stick pipe|Pole bands|Cable Straping")


# Many SKUs are a PACK, not a piece: a box of 100 clamps, a 5000 FT reel, a
# 25-pack of sleeves. The observed consumption ratios are in pieces and feet,
# so the mapping multiplier is in CONSUMPTION units and purchasing has to divide
# by the pack size. Recording the pack size keeps that conversion out of the
# multiplier, where it would silently corrupt the quantity.
PACK_PATTERNS = [
    r"(\d+)\s*pc\s*/\s*BOX",
    r"(\d+)\s*PK\b",
    r"\((\d+)'\)",
    r"(\d+)\s*FT\s*(?:REEL|COIL|TONEABLE|STUB)?\b",
    r"(\d+)\s*ft\b",
    r"(\d+)'\s*Roll",
    r"X\s*(\d+)'",
]

# A vault, handhole or pedestal pay unit installs exactly ONE structure. Where
# the two projects used different structures for the same unit, that is a choice
# of SKU, not a bill of materials, and must not be auto-approved: approving both
# would order two vaults per hole.
SINGLE_CHOICE_CATEGORIES = {"Vault-Handhole", "Pedestal-Cabinet"}


# A number in these descriptions is a built-in tail or stub length, not a pack
# quantity: an "8 PORT HST 500 FT TONEABLE STUB" is one item with 500 FT of tail.
NOT_A_PACK = r"HST|STUB|Feed tail|tail\b"


def pack_size(desc: str) -> str:
    if re.search(NOT_A_PACK, desc, re.I):
        return ""
    for pattern in PACK_PATTERNS:
        m = re.search(pattern, desc, re.I)
        if m:
            n = int(m.group(1))
            if n > 1:
                return str(n)
    return ""


def categorize(desc: str) -> str:
    for pattern, category in CATEGORY_RULES:
        if re.search(pattern, desc, re.I):
            return category
    return "Miscellaneous"


def unit_of(desc: str) -> str:
    if re.search(NOT_FT, desc, re.I):
        return "EA"
    return "FT" if re.search(FT_RULES, desc, re.I) else "EA"


def conduit_package(code: str):
    """Parse pull count and diameter out of a BM60 pay-unit code.

    Mirrors parseConduitPackage in the Fulcrum Data Events script. Kept in step
    with it by tests/conduit-parsing.test.js and this module's own asserts.
    """
    if not code or not code.startswith("BM60"):
        return None
    if code.startswith("BM60-R"):
        return None                                    # rock adder, no conduit
    m = re.match(r"^BM60\((\d+)\)\((\d*\.?\d+)\)", code)
    if m:
        pulls, size = int(m.group(1)), m.group(2)
    else:
        m = re.match(r"^BM60-?\((\d*\.?\d+)\)", code)
        if not m:
            return None                                # micro duct, BM60-DROP
        pulls, size = 1, m.group(1)
    size = f"{float(size):g}"
    if size not in CONDUIT_SIZES_IN_SCOPE:
        return None
    return pulls, size


def conduit_rows(labor_master):
    """Mapping rows for every in-scope conduit pay unit, from the ruling."""
    rows, unresolved = [], []
    for entry in labor_master:
        pkg = conduit_package(entry["code"])
        if pkg is None:
            continue
        pulls, size = pkg

        if size == "1.25":
            sku = BUNDLED_CONDUIT_SKU.get((size, pulls))
            multiplier, basis = 1, f"bundled {pulls}-PULL assembly, 1 FT per production FT"
            if sku is None:
                unresolved.append((
                    entry["code"],
                    f'no bundled {pulls}-PULL 1.25" SKU exists',
                    f"RULING confirms 1.25\" is bundled, but the catalogue stocks "
                    f"1-, 2- and 3-PULL only. A {pulls}-pull run needs either a new "
                    f"SKU or a stated combination of existing ones.",
                ))
                continue
        else:
            sku = SINGLE_PIPE_SKU.get(size)
            multiplier = pulls
            basis = (f'{size}" is always a single-duct pipe, so an {pulls}-pull run '
                     f"consumes {pulls} FT per production FT")
            if sku is None:
                unresolved.append((
                    entry["code"],
                    f'no {size}" single-pipe SKU in the catalogue',
                    f'RULING settles the multiplier at {pulls} (one pipe per pull). '
                    f'Only the {size}" part number is missing.',
                ))
                continue

        rows.append({
            "labor_code": entry["code"],
            "material_code": sku,
            "multiplier": multiplier,
            "waste_factor": CONDUIT_WASTE_FACTOR,
            "source": "BUSINESS_RULE",
            "confidence": "RULING",
            "notes": f"RULING 2026-09-17: {basis}.",
        })
    return rows, unresolved


def observed_rows():
    """Derive ratios from the two projects' consumption records."""
    rows, conflicts = [], []

    units = sorted(set(OBS.PROJECT_A) | set(OBS.PROJECT_B))
    for raw_unit in units:
        if raw_unit.startswith("__"):
            continue
        unit = LABOR_CODE_ALIASES.get(raw_unit, raw_unit)
        per_project = {}
        for name, table in (("A", OBS.PROJECT_A), ("B", OBS.PROJECT_B)):
            if raw_unit not in table:
                continue
            eligible, items = table[raw_unit]
            if not eligible:                    # zero or None: no evidence
                continue
            per_project[name] = {
                item: qty / eligible for item, qty in items if qty
            }
        if not per_project:
            continue

        all_items = sorted(set().union(*(set(d) for d in per_project.values())))
        for item in all_items:
            seen = {p: d[item] for p, d in per_project.items() if item in d}

            if len(seen) >= 2:
                lo, hi = min(seen.values()), max(seen.values())
                if hi - lo <= RATIO_TOLERANCE * hi:
                    ratio = sum(seen.values()) / len(seen)
                    confidence, status_note = "CONFIRMED", (
                        "Ratio independently observed in both projects: "
                        + ", ".join(f"{p}={v:.4g}" for p, v in sorted(seen.items()))
                    )
                else:
                    conflicts.append((
                        unit, item, CATALOGUE.get(item, "?"),
                        ", ".join(f"{p}={v:.4g}" for p, v in sorted(seen.items())),
                        "Projects disagree on the ratio",
                    ))
                    ratio = lo
                    confidence, status_note = "CONFLICT", (
                        "Projects disagree: "
                        + ", ".join(f"{p}={v:.4g}" for p, v in sorted(seen.items()))
                        + ". Lower ratio carried pending a ruling."
                    )
            else:
                project, ratio = next(iter(seen.items()))
                # An item named for this unit in one project but absent from the
                # other, where the other project DID record the unit, is a
                # substantive difference rather than a gap.
                other = {"A": "B", "B": "A"}[project]
                confidence = "SINGLE SOURCE"
                status_note = f"Observed in project {project} only ({ratio:.4g})."
                if other in per_project:
                    # Both projects placed the unit; only one consumed this item.
                    # For assemblies like AFO.SL that is ordinary job-to-job
                    # variation in pole hardware, not a contradiction.
                    status_note += (f" Project {other} placed {unit} without it, so it is "
                                    f"situational rather than always consumed.")

            if unit != raw_unit:
                status_note = f'Source label "{raw_unit}" mapped to pay unit "{unit}". ' + status_note

            rows.append({
                "labor_code": unit,
                "material_code": item,
                "multiplier": round(ratio, 4),
                "waste_factor": "",
                "source": "OBSERVED_CONSUMPTION",
                "confidence": confidence,
                "notes": status_note,
            })

    return rows, conflicts


def main():
    labor_master = json.loads((ROOT / "data" / "labor-master.json").read_text())
    labor_codes = {e["code"] for e in labor_master}

    rows, unresolved = conduit_rows(labor_master)
    obs, conflicts = observed_rows()
    rows += obs

    # Fiber cable SKU is project-specific: two projects placed the same pay unit
    # with different cable. The SKU belongs to the reel, not to the pay unit.
    for row in rows:
        desc = CATALOGUE.get(row["material_code"], "")
        if categorize(desc) == "Fiber Cable":
            row["confidence"] = "REEL-SOURCED"
            row["notes"] = (
                "Fiber cable SKU varies by project - it is a property of the reel, "
                "not of the pay unit. Take it from the linked Fiber Reel record. "
                "Observed ratio " + str(row["multiplier"]) + ". " + row["notes"]
            )

    # ---- material master -------------------------------------------------
    used = sorted({r["material_code"] for r in rows} | set(CATALOGUE))
    master_cols = ["material_code", "description", "category", "unit", "pack_size",
                   "manufacturer", "part_number", "conduit_diameter", "pull_count",
                   "standard_cost", "active", "notes"]
    with (ROOT / "data" / "import" / "material-master.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=master_cols)
        w.writeheader()
        for code in used:
            desc = CATALOGUE.get(code, "")
            diameter = pull = ""
            m = re.match(r"^(\d)-PULL ([\d.]+)", desc)
            if m:
                pull, diameter = m.group(1), m.group(2)
            elif re.match(r'^(\d+)" SDR', desc):
                pull, diameter = "1", re.match(r'^(\d+)" SDR', desc).group(1)
            w.writerow({
                "material_code": code,
                "description": desc or "UNKNOWN - description not supplied",
                "category": categorize(desc),
                "unit": unit_of(desc),
                "pack_size": pack_size(desc),
                "manufacturer": "",
                "part_number": code,
                "conduit_diameter": diameter,
                "pull_count": pull,
                "standard_cost": "",
                "active": "yes",
                "notes": "" if desc else "Item number seen in consumption data with no description",
            })

    # ---- mapping ---------------------------------------------------------
    map_cols = ["mapping_id", "labor_code", "material_code", "material_description",
                "material_unit", "calculation_type", "multiplier", "waste_factor",
                "source", "effective_date", "expiration_date", "active",
                "supersedes_mapping_id", "status", "confidence", "notes"]
    # Aliasing can fold several source labels onto one pay unit. Keep the
    # highest-confidence row per (pay unit, item) and note the fold.
    RANK = {"RULING": 0, "CONFIRMED": 1, "REEL-SOURCED": 2, "SINGLE SOURCE": 3, "CONFLICT": 4}
    merged = {}
    for r in rows:
        key = (r["labor_code"], r["material_code"])
        prior = merged.get(key)
        if prior is None:
            merged[key] = r
        elif RANK[r["confidence"]] < RANK[prior["confidence"]]:
            r["notes"] += f' Supersedes a {prior["confidence"]} row for the same pair.'
            merged[key] = r
        else:
            prior["notes"] += f' A {r["confidence"]} row for the same pair was folded in.'
    rows = list(merged.values())

    # Demote competing single-choice structures.
    from collections import defaultdict
    by_unit_cat = defaultdict(list)
    for r in rows:
        cat = categorize(CATALOGUE.get(r["material_code"], ""))
        if cat in SINGLE_CHOICE_CATEGORIES:
            by_unit_cat[(r["labor_code"], cat)].append(r)
    for (labor_code, cat), group in by_unit_cat.items():
        if len(group) < 2:
            continue
        names = ", ".join(
            f'{r["material_code"]} ({CATALOGUE.get(r["material_code"], "?")})' for r in group
        )
        for r in group:
            r["confidence"] = "COMPETING SKU"
            r["notes"] = (
                f"{labor_code} installs exactly one {cat.replace('-', '/').lower()}, but the "
                f"source data names {len(group)}: {names}. Approving them all would order "
                f"one of each. Pick the standard, or split the pay unit by structure size. "
                + r["notes"]
            )

    rows.sort(key=lambda r: (r["labor_code"], r["material_code"]))
    with (ROOT / "data" / "import" / "labor-material-mapping-proposed.csv").open(
        "w", newline=""
    ) as fh:
        w = csv.DictWriter(fh, fieldnames=map_cols)
        w.writeheader()
        for i, r in enumerate(rows, start=1):
            desc = CATALOGUE.get(r["material_code"], "")
            approved = r["confidence"] in ("RULING", "CONFIRMED")
            note = r["notes"]
            pack = pack_size(desc)
            if pack:
                note += (f" Multiplier is in consumption units; this SKU is a pack of "
                         f"{pack}, so divide by {pack} to purchase.")
            # A single-source ratio that lands on a whole number is a usable
            # baseline: one splice sleeve per splice, one ground rod per ground.
            # A fractional single-source ratio (0.0025 markers per foot) means
            # the denominator is wrong - that item is not driven by this unit's
            # quantity at all - so it stays for review.
            if r["confidence"] == "SINGLE SOURCE":
                ratio = float(r["multiplier"])
                nearest = round(ratio)
                if nearest >= 1 and abs(ratio - nearest) <= 0.02 * nearest:
                    approved = True
                    note = (f"BASELINE: ratio rounds to a whole {nearest} per unit. " + note)
                    r["multiplier"] = nearest
                else:
                    note = ("Fractional ratio - this item is not driven by this unit's "
                            "quantity. Find the true driver (pole count, span count, "
                            "structure count) before approving. " + note)
            if r["labor_code"] not in labor_codes:
                approved = False
                note = (f'Labor code "{r["labor_code"]}" is not a pay unit in the '
                        f"rate sheet - reconcile the naming first. " + note)
            w.writerow({
                "mapping_id": f"MAP-{i:06d}",
                "labor_code": r["labor_code"],
                "material_code": r["material_code"],
                "material_description": desc or "UNKNOWN",
                "material_unit": unit_of(desc),
                "calculation_type": "PER_UNIT",
                "multiplier": r["multiplier"],
                "waste_factor": r["waste_factor"],
                "source": r["source"],
                "effective_date": "2026-01-01",
                "expiration_date": "",
                "active": "yes",
                "supersedes_mapping_id": "",
                "status": "APPROVED" if approved else "NEEDS REVIEW",
                "confidence": r["confidence"],
                "notes": note,
            })

    # ---- conflicts + unresolved -----------------------------------------
    with (ROOT / "data" / "material-mapping-conflicts.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["labor_code", "material_code", "description", "observed", "reason"])
        w.writerows(sorted(conflicts))
        for code, reason, detail in sorted(unresolved):
            w.writerow([code, "", "", reason, detail])

    # Production observed against a label that is not a pay unit, after
    # aliasing, is a BILLING GAP: work is being done with no rate to bill it.
    gaps = []
    for raw_unit, table in [(u, "A") for u in OBS.PROJECT_A] + [(u, "B") for u in OBS.PROJECT_B]:
        if raw_unit.startswith("__"):
            continue
        resolved = LABOR_CODE_ALIASES.get(raw_unit, raw_unit)
        if resolved in labor_codes:
            continue
        src = OBS.PROJECT_A if table == "A" else OBS.PROJECT_B
        eligible = src[raw_unit][0]
        if not eligible:
            continue
        gaps.append((raw_unit, table, eligible))
    with (ROOT / "data" / "labor-billing-gaps.csv").open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["source_label", "project", "eligible_quantity", "reason"])
        for label, project, eligible in sorted(set(gaps)):
            w.writerow([label, project, eligible,
                        "Production recorded against a label with no pay unit in the rate sheet"])

    written = list(csv.DictReader(
        (ROOT / "data" / "import" / "labor-material-mapping-proposed.csv").open()))
    approved = sum(1 for r in written if r["status"] == "APPROVED")
    by_conf = {}
    for r in written:
        by_conf.setdefault(r["confidence"], [0, 0])
        by_conf[r["confidence"]][0 if r["status"] == "APPROVED" else 1] += 1

    print(f"{len(used)} material items")
    print(f"{len(written)} mappings: {approved} APPROVED, {len(written) - approved} NEEDS REVIEW")
    for conf in sorted(by_conf):
        ok, review = by_conf[conf]
        print(f"    {conf:16} {ok:4} approved  {review:4} review")
    print(f"{len(conflicts)} conflicts, {len(unresolved)} conduit SKUs unresolved")
    if gaps:
        print(f"{len(set(g[0] for g in gaps))} billing gaps (production with no pay unit):")
        for label, project, eligible in sorted(set(gaps)):
            print(f"    {label:24} project {project}  {eligible}")
    unmatched = sorted({r["labor_code"] for r in rows if r["labor_code"] not in labor_codes})
    if unmatched:
        print(f"{len(unmatched)} labor codes in the consumption data are not pay units:")
        for c in unmatched:
            print("   ", c)
    return 0


if __name__ == "__main__":
    sys.exit(main())
