-- Add location_id to venues for mapping external import IDs (e.g. click-TT Spiellokal-Nr.)
ALTER TABLE public.venues
  ADD COLUMN location_id INTEGER UNIQUE;
