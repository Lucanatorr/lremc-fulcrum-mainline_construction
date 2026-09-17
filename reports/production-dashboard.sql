-- Production Dashboard  (Sprint 15)
--
-- Today, this week, this month and project-to-date, broken down by contractor,
-- work type, labor code and project.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY THE PERIODS ARE COLUMNS AND THE BREAKDOWNS ARE ROWS
-- The brief asks for four periods and four breakdowns. Sixteen separate
-- queries would be sixteen chances to define "this week" differently. Instead
-- one pass computes all four periods as columns, and GROUPING SETS produces
-- every breakdown level in one result - so a project row and the contractor
-- rows inside it are guaranteed to reconcile.
--
-- "This week" and "this month" are the CURRENT ones, taken from the record's
-- own derived work_week and work_month against today's date. No period is
-- recomputed from work_date (convention 4).
--
-- Quantity appears only on rows grouped down to a single labor code, where one
-- unit of measure applies. Every other level reports value, plus footage and
-- splices which are each fenced to their own unit (convention 2).

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    -- Override to run the dashboard "as at" a past date, for a month-end pack.
    CAST(NULL AS date)    AS p_as_at
),
anchor AS (
  SELECT
    COALESCE(p_as_at, CURRENT_DATE) AS as_at_date
  FROM params
),
base AS (
  SELECT
    p.project_id_snapshot      AS project_id,
    p.project_name_snapshot    AS project_name,
    p.contractor_id_snapshot   AS contractor_id,
    p.contractor_name_snapshot AS contractor_name,
    p.work_category,
    p.labor_code,
    p.unit,
    p.work_date,
    p.work_week,
    p.work_month,
    p.quantity,
    p.extended_value,
    p._status AS record_status,
    a.as_at_date,
    -- The current period labels, derived once from the anchor date so every
    -- row is compared against the same "this week".
    (SELECT MAX(w.work_week) FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" w
      WHERE w.work_date = a.as_at_date)               AS anchor_week_from_data,
    CAST(EXTRACT(YEAR FROM a.as_at_date) AS varchar) || '-'
      || LPAD(CAST(EXTRACT(MONTH FROM a.as_at_date) AS varchar), 2, '0')
                                                      AS anchor_month
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  CROSS JOIN anchor a
  WHERE p._status <> 'VOID'
    AND p.work_date IS NOT NULL
    AND p.work_date <= a.as_at_date
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
),
flagged AS (
  SELECT
    b.*,
    CASE WHEN b.work_date = b.as_at_date THEN 1 ELSE 0 END AS is_today,
    -- This week: the ISO week label of a record dated the anchor day. Where no
    -- record exists on that exact day, fall back to a 7-day window ending on
    -- the anchor, which is the honest approximation rather than an empty column.
    CASE
      WHEN b.anchor_week_from_data IS NOT NULL
        THEN CASE WHEN b.work_week = b.anchor_week_from_data THEN 1 ELSE 0 END
      ELSE CASE WHEN b.work_date > b.as_at_date - INTERVAL '7' DAY THEN 1 ELSE 0 END
    END AS is_this_week,
    CASE WHEN b.work_month = b.anchor_month THEN 1 ELSE 0 END AS is_this_month
  FROM base b
)
SELECT
  CASE
    WHEN GROUPING(labor_code)     = 0 THEN 'PROJECT x CONTRACTOR x WORK TYPE x LABOR CODE'
    WHEN GROUPING(work_category)  = 0 THEN 'PROJECT x CONTRACTOR x WORK TYPE'
    WHEN GROUPING(contractor_id)  = 0 THEN 'PROJECT x CONTRACTOR'
    WHEN GROUPING(project_id)     = 0 THEN 'PROJECT'
    ELSE 'ALL PROJECTS'
  END                                          AS breakdown_level,
  project_id,
  MAX(project_name)                            AS project_name,
  contractor_id,
  MAX(contractor_name)                         AS contractor_name,
  work_category,
  labor_code,
  CASE WHEN GROUPING(labor_code) = 0 THEN MAX(unit) END AS unit,

  -- TODAY
  ROUND(CAST(SUM(CASE WHEN is_today = 1 AND record_status = 'APPROVED'
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS today_approved_value,
  CASE WHEN GROUPING(labor_code) = 0
       THEN SUM(CASE WHEN is_today = 1 AND record_status = 'APPROVED'
                     THEN COALESCE(quantity,0) ELSE 0 END) END
                                               AS today_approved_quantity,
  ROUND(CAST(SUM(CASE WHEN is_today = 1
                        AND record_status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS today_pending_value,

  -- THIS WEEK
  ROUND(CAST(SUM(CASE WHEN is_this_week = 1 AND record_status = 'APPROVED'
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS week_approved_value,
  CASE WHEN GROUPING(labor_code) = 0
       THEN SUM(CASE WHEN is_this_week = 1 AND record_status = 'APPROVED'
                     THEN COALESCE(quantity,0) ELSE 0 END) END
                                               AS week_approved_quantity,

  -- THIS MONTH
  ROUND(CAST(SUM(CASE WHEN is_this_month = 1 AND record_status = 'APPROVED'
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS month_approved_value,
  CASE WHEN GROUPING(labor_code) = 0
       THEN SUM(CASE WHEN is_this_month = 1 AND record_status = 'APPROVED'
                     THEN COALESCE(quantity,0) ELSE 0 END) END
                                               AS month_approved_quantity,

  -- PROJECT TO DATE
  ROUND(CAST(SUM(CASE WHEN record_status = 'APPROVED'
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS ptd_approved_value,
  CASE WHEN GROUPING(labor_code) = 0
       THEN SUM(CASE WHEN record_status = 'APPROVED'
                     THEN COALESCE(quantity,0) ELSE 0 END) END
                                               AS ptd_approved_quantity,
  ROUND(CAST(SUM(CASE WHEN record_status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS ptd_pending_value,

  -- Physical headlines, each fenced to one unit of measure so they are valid at
  -- every breakdown level including the totals.
  SUM(CASE WHEN record_status = 'APPROVED' AND unit = 'FT'
           THEN COALESCE(quantity,0) ELSE 0 END)        AS ptd_footage,
  SUM(CASE WHEN record_status = 'APPROVED' AND unit = 'SPLICE'
           THEN COALESCE(quantity,0) ELSE 0 END)        AS ptd_splices,
  SUM(CASE WHEN record_status = 'APPROVED' AND unit = 'EA'
           THEN COALESCE(quantity,0) ELSE 0 END)        AS ptd_each,
  ROUND(CAST(SUM(CASE WHEN record_status = 'APPROVED' AND unit IN ('HR','EVENT')
                      THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                                        AS ptd_time_and_materials_value,

  COUNT(CASE WHEN record_status = 'APPROVED' THEN 1 END) AS approved_transactions,
  COUNT(DISTINCT CASE WHEN record_status = 'APPROVED' THEN work_date END)
                                                        AS days_with_approved_production,
  MAX(as_at_date)                                       AS as_at_date
FROM flagged
GROUP BY GROUPING SETS (
  (project_id, contractor_id, work_category, labor_code),
  (project_id, contractor_id, work_category),
  (project_id, contractor_id),
  (project_id),
  ()
)
ORDER BY
  GROUPING(project_id), project_id,
  GROUPING(contractor_id), contractor_id,
  GROUPING(work_category), work_category,
  GROUPING(labor_code), labor_code;
