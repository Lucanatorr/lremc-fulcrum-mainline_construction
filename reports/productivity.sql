-- Productivity Report  (Sprint 16)
--
-- Factual productivity by crew, contractor and construction method:
-- FT/day, EA/day, splices/day, SF/day and production value/day.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY THE PHYSICAL COLUMNS ARE FENCED BY UNIT AND VALUE IS NOT
-- The brief: "Do not mix unlike units into a meaningless physical-production
-- total. Financial production can be aggregated across different labor units
-- because they share a currency unit."
--
-- So every physical column here is fenced to ONE unit of measure -- feet with
-- feet, each with each, splices with splices -- and appears as its own column
-- rather than being added together. Value is the only figure aggregated across
-- pay units, because dollars are dollars.
--
-- WHY ZERO-PRODUCTION DAYS ARE EXCLUDED
-- The brief: "Avoid including zero-production days unless the business rule
-- specifically requires them." A crew that placed 4,000 FT across 4 working
-- days ran at 1,000 FT/day. Dividing by the 5 working days in the week instead
-- would report 800 FT/day and make a productive crew look slow because it was
-- rained out on Friday. So the denominator is ACTIVE days -- days this crew
-- actually booked production -- not elapsed calendar or working days.
--
-- There are two denominators on purpose. A day spent entirely on flagging (HR)
-- earns value but puts nothing in the ground, so it counts as an active day for
-- value and NOT for physical production. Using one denominator for both would
-- understate the physical rate of any crew that did T&M work.
--
-- Saturdays and Sundays are excluded: the working week is Mon-Fri (ruling
-- 2026-09-16). Weekend production still exists and still counts toward totals
-- in the production reports; it is left out of a per-working-day RATE because
-- the rate is meant to describe a normal working day.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to
),

-- Approved only: convention 1. Pending work is not production yet, and a rate
-- computed from it would move every time a reviewer changed their mind.
base AS (
  SELECT
    p.crew,
    p.contractor_id_snapshot,
    p.contractor_name_snapshot,
    p.construction_method,
    p.work_date,
    p.unit,
    p.labor_code,
    COALESCE(p.quantity, 0)       AS quantity,
    COALESCE(p.extended_value, 0) AS extended_value,
    -- Physical production: everything except time-and-materials (convention 3).
    CASE WHEN p.unit NOT IN ('HR', 'EVENT') AND COALESCE(p.quantity, 0) > 0
         THEN 1 ELSE 0 END        AS is_physical
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status = 'APPROVED'
    AND p.work_day_of_week NOT IN ('Saturday', 'Sunday')
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_date_from     IS NULL OR p.work_date >= p_date_from)
    AND (p_date_to       IS NULL OR p.work_date <= p_date_to)
),

by_crew AS (
  SELECT
    'CREW'                          AS dimension_type,
    COALESCE(crew, '(no crew recorded)') AS dimension_value,
    COUNT(DISTINCT work_date)       AS value_active_days,
    COUNT(DISTINCT CASE WHEN is_physical = 1 THEN work_date END) AS physical_active_days,
    COUNT(DISTINCT labor_code)      AS distinct_pay_units,
    SUM(CASE WHEN unit = 'FT'     THEN quantity ELSE 0 END) AS ft_total,
    SUM(CASE WHEN unit = 'EA'     THEN quantity ELSE 0 END) AS each_total,
    SUM(CASE WHEN unit = 'SPLICE' THEN quantity ELSE 0 END) AS splice_total,
    SUM(CASE WHEN unit = 'SF'     THEN quantity ELSE 0 END) AS sf_total,
    SUM(CASE WHEN unit = 'HR'     THEN quantity ELSE 0 END) AS hours_total,
    SUM(extended_value)             AS value_total
  FROM base
  GROUP BY crew
),
by_contractor AS (
  SELECT
    'CONTRACTOR'                    AS dimension_type,
    COALESCE(contractor_name_snapshot, contractor_id_snapshot, '(none)') AS dimension_value,
    COUNT(DISTINCT work_date)       AS value_active_days,
    COUNT(DISTINCT CASE WHEN is_physical = 1 THEN work_date END) AS physical_active_days,
    COUNT(DISTINCT labor_code)      AS distinct_pay_units,
    SUM(CASE WHEN unit = 'FT'     THEN quantity ELSE 0 END) AS ft_total,
    SUM(CASE WHEN unit = 'EA'     THEN quantity ELSE 0 END) AS each_total,
    SUM(CASE WHEN unit = 'SPLICE' THEN quantity ELSE 0 END) AS splice_total,
    SUM(CASE WHEN unit = 'SF'     THEN quantity ELSE 0 END) AS sf_total,
    SUM(CASE WHEN unit = 'HR'     THEN quantity ELSE 0 END) AS hours_total,
    SUM(extended_value)             AS value_total
  FROM base
  GROUP BY COALESCE(contractor_name_snapshot, contractor_id_snapshot, '(none)')
),
by_method AS (
  SELECT
    'CONSTRUCTION METHOD'           AS dimension_type,
    COALESCE(construction_method, '(not recorded)') AS dimension_value,
    COUNT(DISTINCT work_date)       AS value_active_days,
    COUNT(DISTINCT CASE WHEN is_physical = 1 THEN work_date END) AS physical_active_days,
    COUNT(DISTINCT labor_code)      AS distinct_pay_units,
    SUM(CASE WHEN unit = 'FT'     THEN quantity ELSE 0 END) AS ft_total,
    SUM(CASE WHEN unit = 'EA'     THEN quantity ELSE 0 END) AS each_total,
    SUM(CASE WHEN unit = 'SPLICE' THEN quantity ELSE 0 END) AS splice_total,
    SUM(CASE WHEN unit = 'SF'     THEN quantity ELSE 0 END) AS sf_total,
    SUM(CASE WHEN unit = 'HR'     THEN quantity ELSE 0 END) AS hours_total,
    SUM(extended_value)             AS value_total
  FROM base
  GROUP BY construction_method
),

combined AS (
  SELECT * FROM by_crew
  UNION ALL SELECT * FROM by_contractor
  UNION ALL SELECT * FROM by_method
)

SELECT
  dimension_type,
  dimension_value,
  physical_active_days,
  value_active_days,
  distinct_pay_units,

  ROUND(CAST(ft_total     AS numeric), 2) AS ft_total,
  ROUND(CAST(each_total   AS numeric), 2) AS each_total,
  ROUND(CAST(splice_total AS numeric), 2) AS splice_total,
  ROUND(CAST(sf_total     AS numeric), 2) AS sf_total,
  ROUND(CAST(hours_total  AS numeric), 2) AS hours_total,
  ROUND(CAST(value_total  AS numeric), 2) AS value_total,

  -- NULLIF, not a CASE: with no active days the rate is undefined, and NULL
  -- says so. A zero would read as "this crew produced nothing per day", which
  -- is a different and false claim.
  ROUND(CAST(ft_total     AS numeric) / NULLIF(physical_active_days, 0), 2) AS ft_per_active_day,
  ROUND(CAST(each_total   AS numeric) / NULLIF(physical_active_days, 0), 2) AS each_per_active_day,
  ROUND(CAST(splice_total AS numeric) / NULLIF(physical_active_days, 0), 2) AS splices_per_active_day,
  ROUND(CAST(sf_total     AS numeric) / NULLIF(physical_active_days, 0), 2) AS sf_per_active_day,
  ROUND(CAST(value_total  AS numeric) / NULLIF(value_active_days, 0), 2)    AS value_per_active_day,

  -- A rate computed from one or two days is arithmetic, not a trend. Said out
  -- loud so nobody plans against it.
  CASE
    WHEN physical_active_days IS NULL OR physical_active_days = 0 THEN 'NO PHYSICAL PRODUCTION'
    WHEN physical_active_days < 3 THEN 'THIN - under 3 active days'
    WHEN physical_active_days < 10 THEN 'INDICATIVE'
    ELSE 'ESTABLISHED'
  END AS sample_strength
FROM combined
ORDER BY dimension_type, value_total DESC, dimension_value;
