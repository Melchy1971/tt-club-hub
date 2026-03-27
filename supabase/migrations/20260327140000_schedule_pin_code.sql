-- Spielplan: PIN und Code Felder für Begegnungsverwaltung
-- PIN  = Zugangscode zum Online-Ergebnismeldungssystem (z.B. click-tt)
-- Code = Begegnungsnummer/Matchcode des Verbands

ALTER TABLE public.schedule_matches
  ADD COLUMN IF NOT EXISTS pin  TEXT,
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Optional: Kommentar-Indizes (keine Eindeutigkeit nötig, nur Suche)
-- Bewusst kein Index – PIN/Code werden selten gefiltert, nur angezeigt/editiert.

COMMENT ON COLUMN public.schedule_matches.pin  IS 'Zugangscode für das Online-Ergebnismeldungssystem (z.B. click-tt PIN)';
COMMENT ON COLUMN public.schedule_matches.code IS 'Begegnungsnummer/Matchcode des zuständigen Verbands';
