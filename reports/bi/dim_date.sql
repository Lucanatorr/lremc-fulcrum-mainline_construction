-- dim_date  (Sprint 29 - Power BI date dimension)  key: date_key
--
-- One row per calendar day. date_key = YYYYMMDD integer, the join key every
-- fact uses. Year, quarter, month, ISO week, day, the working-day flag, the
-- reporting period exactly as production records carry it (YYYY-MM), and
-- fiscal periods.
--
-- FISCAL YEAR: p_fiscal_start_month is 1 (calendar year) until the business
-- states otherwise. A fiscal year is named for the calendar year it ENDS in.
-- No table is read: the range is generated, so the dimension exists before
-- the first record does. Holidays are not known to Fulcrum; is_holiday is
-- left for Power BI to overlay from the business's own calendar.

WITH params AS (
  SELECT CAST('2026-01-01' AS date) AS p_from,
         CAST('2028-12-31' AS date) AS p_to,
         CAST(1 AS integer)         AS p_fiscal_start_month
),
d AS (
  SELECT CAST(g.day AS date) AS day, p_fiscal_start_month AS fsm
  FROM params, generate_series(p_from, p_to, INTERVAL '1' DAY) AS g(day)
)
SELECT
  CAST(TO_CHAR(day, 'YYYYMMDD') AS integer)                        AS date_key,
  day                                                              AS calendar_date,
  CAST(EXTRACT(YEAR FROM day) AS integer)                          AS year,
  CAST(EXTRACT(QUARTER FROM day) AS integer)                       AS quarter,
  TO_CHAR(day, 'YYYY') || '-Q' || TO_CHAR(day, 'Q')                AS year_quarter,
  CAST(EXTRACT(MONTH FROM day) AS integer)                         AS month,
  TO_CHAR(day, 'Mon')                                              AS month_name,
  TO_CHAR(day, 'YYYY-MM')                                          AS year_month,
  TO_CHAR(day, 'YYYY-MM')                                          AS reporting_period,
  CAST(EXTRACT(ISOYEAR FROM day) AS integer)                       AS iso_year,
  CAST(EXTRACT(WEEK FROM day) AS integer)                          AS iso_week,
  TO_CHAR(day, 'IYYY') || '-W' || TO_CHAR(day, 'IW')               AS work_week,
  CAST(day - CAST(EXTRACT(ISODOW FROM day) AS integer) + 1 AS date) AS week_start_monday,
  CAST(EXTRACT(DAY FROM day) AS integer)                           AS day_of_month,
  CAST(EXTRACT(ISODOW FROM day) AS integer)                        AS iso_day_of_week,
  TRIM(TO_CHAR(day, 'Day'))                                        AS day_name,
  CASE WHEN EXTRACT(ISODOW FROM day) < 6 THEN 1 ELSE 0 END         AS is_working_day,
  CAST(EXTRACT(YEAR FROM day) AS integer)
    + CASE WHEN fsm > 1 AND EXTRACT(MONTH FROM day) >= fsm THEN 1 ELSE 0 END AS fiscal_year,
  CAST(MOD(CAST(EXTRACT(MONTH FROM day) AS integer) - fsm + 12, 12) + 1 AS integer) AS fiscal_period,
  CAST((MOD(CAST(EXTRACT(MONTH FROM day) AS integer) - fsm + 12, 12)) / 3 + 1 AS integer) AS fiscal_quarter
FROM d
ORDER BY day;
