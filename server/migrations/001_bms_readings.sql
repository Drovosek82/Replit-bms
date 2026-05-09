-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/deekjlmbrwmhfoeipuqr/sql/new

CREATE TABLE IF NOT EXISTS bms_readings (
  id            BIGSERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voltage       NUMERIC,
  current       NUMERIC,
  soc           NUMERIC,
  remaining_cap NUMERIC,
  full_cap      NUMERIC,
  cycles        INTEGER,
  temp1         NUMERIC,
  temp2         NUMERIC,
  cells         JSONB,
  protection    INTEGER,
  charge_mos    BOOLEAN,
  discharge_mos BOOLEAN
);

CREATE INDEX IF NOT EXISTS bms_readings_device_time
  ON bms_readings (device_id, received_at DESC);

-- Optional: auto-delete old rows (keep last 30 days)
-- CREATE OR REPLACE FUNCTION delete_old_bms_readings()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   DELETE FROM bms_readings
--   WHERE received_at < NOW() - INTERVAL '30 days';
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER bms_readings_cleanup
-- AFTER INSERT ON bms_readings
-- EXECUTE PROCEDURE delete_old_bms_readings();
