# Field Inspector Training — Mainline Construction

Sprint 25. For anyone who records production in the field. About 45 minutes
with a device in hand, using the **Development** app and the test project
`MCP-TEST-001`. Never train on a live project.

**Before the session.** Your Fulcrum account must be on a role that can
**create, update and change the status of** records. The role currently named
*Inspector* can only create, so it cannot submit or correct a record (Sprint 24
finding P-3). Check this first, or step 6 will fail in front of the class.

---

## 1. Getting in and getting the data onto the device

1. Sign in to the Fulcrum mobile app with your own account. Never use a shared
   one: every record is stamped with the person who created it, and approval
   depends on that name.
2. **Sync before you leave the office.** The app needs the project list, the
   contractor list, the rate list, the reel list and the structure list on the
   device. They come down with a sync. Out of signal, you can only pick from
   what was synced.
3. Open **Mainline Construction - Development**.

> If a project, contractor or rate you expect is missing from a pick list,
> sync again. If it is still missing, it does not exist or is inactive. Phone
> the administrator; do not pick the nearest one.

## 2. Starting a record — the fields that matter

Tap **+** for a new record. The **PROJECT INFORMATION** section:

| Field | What to do | Why it matters |
|---|---|---|
| **Project** | Pick from the list | Carries over to your next record |
| **Contractor** | Pick from the list | Carries over |
| **Work Date** | **Set it every time** | It is the only field that deliberately does **not** carry over. Yesterday's date on this morning's work puts it in the wrong week and the wrong forecast, with nothing to catch it |
| Crew, Route | Type them | Used to compare crews; carry over |

Year, Month, Week and Reporting Period fill themselves. The week is ISO,
Monday to Sunday.

The **WORK INFORMATION** section:

| Field | What to do |
|---|---|
| **Work Category** | Underground, Aerial, Fiber Placement, Splicing… It decides which sections the form shows you |
| Construction Method | Optional; pick it if it applies |
| **Labor Code** | The pay unit from the rate sheet. It fills the description, the pull count, the conduit size and the splice band |
| **Quantity** | How many units. For fiber in feet, leave it to the sequentials (§4) |
| **Production Type** | Leave it at **Original**. *Adjustment* is for office corrections only (§7) |

The **PRODUCTION VALUE** section: pick the **Applicable Contractor Rate**,
which is the rate for this contractor and this labor code. This is what prices the
work, and it fills the **Unit**. **With no rate the record cannot be approved.**

## 3. Location, GPS and photos

- **From / To Location / Structure**: the two ends of the work. Pick the
  structures if they exist in the list; otherwise type the IDs. Both ends
  together make the **Segment ID**. Direction does not matter: HH-1→HH-2 and
  HH-2→HH-1 are the same segment.
- **GPS** is taken from the record's location. Stand at the work when you
  create the record, or set the location on the map.
- **Photos** (in QA / QC): at least one. A record with no photo gets a
  warning, and an approved one with no photo shows up on the closeout report.

## 4. By work type

### Underground
- The labor code fills **Pull Count** and **Conduit Diameter**. You never type them.
- **Depth (inches)**: under 36 gives a warning (contract minimum).
- **Crossing Type** = Railroad on a non-railroad labor code gives a warning:
  you have probably picked the wrong code.
- Record **Restoration Required / Type / Status** if you disturbed a surface.

### Aerial
- **Pole ID**, plus the **Previous Pole ID** and **Next Pole ID**. Together they make
  the **Span ID**. No Pole ID means no span.
- **Span Footage**: a very long span gives a warning. Check the digits.

### Fiber placement
- Pick the **Fiber Reel**. The reel's printed range comes with it.
- Enter **Starting Sequential** and **Ending Sequential** off the cable jacket.
  **Sequential Footage** is calculated for you, in either direction.
- **Slack Footage** and **Other Added Footage** go in their own boxes. Never
  add them into the sequentials. Keeping them apart is how the reel report
  tells cable in the ground from cable on the floor.
- If you type a Quantity that disagrees by more than 5% with the installed
  footage (sequential + slack + other), you get a warning. It is usually a
  transposed digit.

### Splicing
- **Fiber Count at Location** decides the priced splice band. If it falls
  outside the band the labor code prices, that is a **CRITICAL** exception:
  the work would be billed in the wrong band.
- **Splice Quantity** should equal the Quantity. If it doesn't, you get a warning.
- Record the **Test Type**, **Measured Loss (dB)** and **Test Result**. Loss
  over 0.10 dB, or a FAIL, gives a warning. A splicing record with no test
  result shows up on the closeout report.

## 5. The exception box and what it means

The **Exceptions (auto)** box in QA / QC lists everything the app noticed.

| Level | Meaning | Can I save? | Can it be approved? |
|---|---|---|---|
| INFO | Noted | Yes | Yes |
| WARNING | Worth a look | **Yes, always** | Yes |
| CRITICAL | It cannot be priced or counted as it stands | Yes | **No** |

**A warning never loses your work.** Apart from a required field left blank,
the only thing that stops a field save is a negative quantity on an Original
record. The other refusals (approving with a CRITICAL, reopening or reversing
without a reason) are office actions.

The CRITICALs you will meet in the field:

- *No contractor rate linked*: pick the rate.
- *Rate prices labor code X but this production uses Y*: you changed the labor
  code after picking the rate. Pick the rate again.
- *Work date is after the rate expiration date*: phone the office. Do not pick
  another rate to make it go away.
- *Fiber count falls outside the priced band*: wrong labor code or wrong count.

## 6. Submitting, and fixing what comes back

| Status | Who sets it | What it means for you |
|---|---|---|
| DRAFT | You (default) | Yours to edit |
| **SUBMITTED** | **You**, when the record is complete | Off your desk. *Submitted By / Date* stamp themselves |
| UNDER REVIEW | Reviewer | Being looked at |
| **CORRECTION REQUIRED** | Reviewer | **Back to you**, with a reason in *QA Reviewer Outcome Detail* |
| APPROVED | Reviewer | Counts as production. **Quantity, Labor Code and Rate lock** |
| REJECTED | Reviewer | Not production; the reason is in *Rejection / Correction Reason* |
| VOID | Office | Entered in error; excluded everywhere |
| REOPENED / REVERSED | Office only | See §7 |

**When a record comes back as CORRECTION REQUIRED:**
1. Read *QA Reviewer Outcome Detail* and *Rejection / Correction Reason*.
2. Fix what it says.
3. Set **Correction Completed = Yes**. The date and your name fill in.
4. Change the status to **SUBMITTED** again.

## 7. Things that are not yours to do

- **Never delete a record.** If it is wrong and not yet approved, ask for it
  to be **VOIDed**.
- **Never change an approved record.** The office REOPENS it with a reason,
  REVERSES it, or enters an **Adjustment**. Each correction stays visible.
- **Never type a negative quantity.** It is refused on an Original record.

## 8. Working offline, and resyncing

Everything on the form works with no signal: pick lists, calculations,
exceptions and the approval rules. What the device **cannot** know offline is
anything about **other** records:

- whether someone else already recorded the same sequential range;
- whether the same work was entered twice;
- whether the project's scope is used up.

Those are caught by reports after you sync, before approval. **Sync at the
end of every day**, and as soon as you have signal after a long stretch
without. The office cannot see or approve what is still on your device.

## 9. Practice exercises (Development app, MCP-TEST-001)

1. An Underground record: one 1.25" directional bore pull of 500 FT. Check that
   the unit fills as FT and Extended Value appears.
2. A Fiber Placement record from sequentials 101250 → 100000. Confirm 1,250 FT.
3. A Splicing record with a fiber count outside the labor code's band. Find the
   CRITICAL. Fix it.
4. Submit a record. Have the trainer send it back as CORRECTION REQUIRED. Fix
   it and resubmit.
5. Go into airplane mode, create a record, then sync. Confirm it arrives.

**Sign-off:** trainee and trainer initial each exercise in the UAT feedback register.
