-- dim_reel  (Sprint 29)  key: reel_id
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
-- Printed range and waste only. Consumed and remaining footage are NOT
-- attributes (D-012): they are sums over fact_production.sequential_footage.

SELECT
  r.reel_id,
  r.project_id_snap               AS project_id,
  r.contractor_id_snap            AS contractor_id,
  r.manufacturer, r.cable_type, r.fiber_count,
  r.beginning_sequential, r.ending_sequential,
  r.original_reel_footage,
  r.waste_recorded,
  r._status                       AS reel_status,
  r._record_id                    AS fulcrum_record_id
FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f" r
ORDER BY r.reel_id;
