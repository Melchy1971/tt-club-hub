# Schedule Import Parser Design (CSV / Excel / click-TT)

## Parser-Design

- Einheitlicher Parser `parseScheduleMatches(rows, options)` für alle Quellen.
- Header-Alias-Mapping normalisiert Quelle auf kanonische Felder (`date`, `time`, `homeTeam`, `awayTeam`, `league`, `venue`, `pin`, `code`, ...).
- Jede Eingabezeile produziert **immer** ein `RowImportResult` inkl. `status` (`success`, `partial`, `failed`) und Issues; Zeilen werden bei Unsicherheit nicht verworfen.
- Heim/Auswärts-Erkennung über:
  1. explizite `is_home`-Spalte,
  2. Club-Name-Abgleich gegen Heim-/Gastname,
  3. Warnung bei unklarer Lage.
- `sourceFingerprint` wird als stabiler Dedupe-Key aus Datum/Zeit/Heim/Gast erzeugt.

## Mapping-Regeln

### Felder

- **Datum**: ISO (`YYYY-MM-DD`) direkt, deutsches Format (`DD.MM.YYYY`) wird konvertiert.
- **Zeit**: `HH:MM` / `H:MM` (optional mit Sekunden) → `HH:MM`.
- **Gegner**: priorisiert `opponent`, sonst aus Heim/Auswärts abgeleitet.
- **Pin/Code**: stringbasiert, trimmen, leere Werte → `null`.

### season_phase

- Enthält `Jugend` → `single_half`
- Enthält `Vorrunde` oder `VR` → `first_half`
- Enthält `Rückrunde`/`Rueckrunde` oder `RR` → `second_half`
- Sonst unresolved warning.

## Konfliktlogik

1. **Deduplizierung**: identischer Fingerprint → `DUPLICATE_RECORD` (warning), Referenz auf erste Zeile.
2. **Mehrdeutigkeit vor harter Ablehnung**: uneindeutige Datumsformate (`01/02/26`) werden als `AMBIGUOUS_DATE` markiert.
3. **Feldpriorität**: explizite Spalte schlägt Ableitung (z. B. `is_home` vor Club-Matching).
4. **Statusermittlung**:
   - mindestens ein `error|fatal` → `failed`
   - sonst Issues vorhanden → `partial`
   - sonst `success`

## Fehlermodell

- Reuse vorhandener Import-Issue-Codes (`MISSING_REQUIRED_FIELD`, `INVALID_DATE`, `AMBIGUOUS_DATE`, `LOW_CONFIDENCE_MATCH`, `UNRESOLVED_REFERENCE`, `DUPLICATE_RECORD`).
- Pro Zeile mehrere Issues möglich.
- Aggregierte Issues werden zusätzlich im Gesamtreport geführt (`rowIndex` gesetzt).

## Edge Cases

- Datumswerte aus Excel-Exporten als Text mit `/` statt `.`.
- Fehlende Heim-/Gastnamen trotz vorhandenem Datum.
- Teamname enthält Vereinsnamen nur teilweise (z. B. „TT Club Hub III“).
- Jugendliga mit Zusatztexten („Jugend 19 Bezirksklasse VR“) → `single_half` hat Vorrang.
- Dubletten über verschiedene Quellen (CSV + click-TT).
