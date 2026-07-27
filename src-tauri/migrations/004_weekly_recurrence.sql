ALTER TABLE session_series
  ADD COLUMN interval_weeks INTEGER NOT NULL DEFAULT 1
  CHECK (interval_weeks > 0);

ALTER TABLE session_series
  ADD COLUMN weekdays_mask INTEGER
  CHECK (weekdays_mask IS NULL OR weekdays_mask BETWEEN 1 AND 127);

ALTER TABLE session_series
  ADD COLUMN occurrence_count INTEGER
  CHECK (occurrence_count IS NULL OR occurrence_count > 0);
