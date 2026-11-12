-- fact_change_order_line  (Sprint 29)  grain: one change-order line.
--   key: change_order_number + line_index
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development (+ /quantity_changes)
--
-- A line is a SIGNED delta (+500 / -200), never a revised total. Only APPROVED
-- lines move authorized scope: is_authorized marks them, so authorized scope
-- in Power BI = fact_scope.planned_quantity + SUM(quantity_change WHERE
-- is_authorized = 1), per project and labor code.

SELECT
  co.change_order_number,
  co.change_order_number || '|' || CAST(ROW_NUMBER() OVER (PARTITION BY co._record_id ORDER BY l._record_id) AS varchar) AS change_order_line_key,
  co._record_id                                                       AS fulcrum_record_id,
  co.project_id_snap                                                  AS project_id,
  co.contractor_id_snap                                               AS contractor_id,
  co._status                                                          AS change_order_status,
  CASE WHEN co._status = 'APPROVED' THEN 1 ELSE 0 END                 AS is_authorized,
  CASE WHEN co._status IN ('DRAFT', 'SUBMITTED') THEN 1 ELSE 0 END    AS is_pending,
  CAST(TO_CHAR(CAST(co.date_submitted AS date), 'YYYYMMDD') AS integer) AS submitted_date_key,
  CAST(TO_CHAR(CAST(co.date_approved AS date), 'YYYYMMDD') AS integer)  AS approved_date_key,
  co.reason,
  l.line_labor_code                                                   AS labor_code,
  l.line_unit                                                         AS unit,
  l.line_quantity_change                                              AS quantity_change,
  l.line_rate                                                         AS rate,
  l.line_value                                                        AS value_change
FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" l
JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co ON co._record_id = l._parent_id
ORDER BY co.change_order_number, change_order_line_key;
