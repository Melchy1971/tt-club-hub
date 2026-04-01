# Import-Architektur (CSV/Excel/click-TT)

## Ziele
- Ein einheitlicher Import-Flow für **CSV**, **Excel** (`.xlsx/.xls`) und **click-TT**-Exporte.
- **Partielle Fehlerbehandlung**: einzelne Zeilen dürfen fehlschlagen, ohne den gesamten Job abzubrechen.
- Konfigurierbare **Match-Strategien** für `members`, `teams`, `matches`.
- Robuste Normalisierung für **QTTR/TTR** und **Datumsfelder**.
- Transparenter **Import-Report** mit Erfolgen, Warnungen und Fehlern.

---

## 1) Parser-Design

### 1.1 Schichtenmodell
1. **Source Reader**
   - `CsvReader`: delimiter-aware (`;`, `,`, tab), BOM-strip, Header-Detection.
   - `ExcelReader`: Sheet-Auswahl (standardmäßig erstes nicht-leeres Sheet), Header-Zeile inferieren.
   - `ClickTtReader`: Spezialreader für bekannte click-TT-Spalten + Varianten.

2. **Canonical Row Mapper**
   - Transformiert rohe Input-Zeilen in ein kanonisches Zwischenformat (`CanonicalRow`).
   - Führt Header-Alias-Mapping aus (z. B. `Vorname`, `first_name`, `First Name` → `firstName`).

3. **Normalizer**
   - Typisierung/Normierung (Strings trimmen, Numbers parsen, Datumsformate normalisieren, QTTR/TTR validieren).
   - Liefert Feld-Level-Warnungen statt harter Fehler, wo möglich.

4. **Entity Matcher**
   - Best-Match gegen bestehende Daten (`members`, `teams`, `matches`) mittels Strategy Chain.

5. **Import Executor**
   - Führt `insert`, `update`, `upsert`, `skip` je Zeile aus.
   - Isoliert jede Zeile transaktional (oder in kleinen Batches mit Savepoint-Logik).

6. **Reporter**
   - Aggregiert Metriken, Zeilenprotokolle, Feldwarnungen, Konflikte, Dedupe-Ergebnisse.

### 1.2 Pipeline-Vertrag
```ts
parse(file) -> RawTable
map(raw) -> CanonicalRow[]
normalize(rows) -> NormalizedRow[]
match(rows, context) -> MatchedRow[]
execute(rows, mode) -> PersistResult[]
report(results) -> ImportReport
```

### 1.3 Fehlertoleranz-Modell
- **Fatal Errors** (Job-Abbruch):
  - Datei unlesbar/korrupt.
  - Header-Zeile nicht identifizierbar.
  - Harte Schema-Inkompatibilität (z. B. keine nutzbaren Schlüsselspalte).
- **Row Errors** (kein Abbruch):
  - Pflichtfeld fehlt, keine Zuordnung möglich, DB-Constraint pro Zeile.
- **Field Warnings** (kein Abbruch):
  - Unbekanntes Datumsformat (Fallback `null`), QTTR außerhalb Range (Wert verworfen), Teamname fuzzy statt exact.

---

## 2) Mapping-Regeln

### 2.1 Header-Aliases (Beispiele)

#### Members
- `firstName`: `Vorname`, `First Name`, `firstname`, `first_name`
- `lastName`: `Nachname`, `Last Name`, `lastname`, `last_name`
- `email`: `E-Mail`, `email`, `mail`
- `ttr`: `TTR`, `TTR-Punkte`, `ttr_rating`
- `qttr`: `QTTR`, `Q-TTR`, `qttr_rating`
- `birthDate`: `Geburtsdatum`, `DOB`, `birth_date`

#### Teams
- `teamName`: `Mannschaft`, `Team`, `team_name`
- `league`: `Liga`, `Staffel`, `league`
- `ageGroup`: `Altersklasse`, `age_group`

#### Matches
- `matchDate`: `Datum`, `Spieltag`, `date`
- `startTime`: `Uhrzeit`, `Start`, `time`
- `homeTeam`: `Heim`, `Heimmannschaft`, `home_team`
- `awayTeam`: `Gast`, `Gastmannschaft`, `away_team`
- `opponent`: `Gegner`, `Opponent`
- `result`: `Ergebnis`, `result`
- `round`: `Runde`, `Spieltag-Nr`, `match_day`

### 2.2 Priorisierte Feldzuordnung
1. Manuelles Mapping aus UI (wenn gesetzt)
2. Explizite alias-basierte Regeln
3. Fuzzy Header-Match (Levenshtein/Jaro-Winkler) mit Confidence-Threshold
4. Fallback: ungemappt + Warnung

### 2.3 Pflicht-/Optionalregeln
- `members`: mindestens `firstName + lastName` oder `email`.
- `teams`: mindestens `teamName`.
- `matches`: mindestens `matchDate` plus (`homeTeam+awayTeam` oder `team+opponent`).

---

## 3) Match-Strategien

### 3.1 Allgemeines Strategy-Interface
```ts
interface MatchStrategy<TInput, TEntity> {
  name: string;
  score(input: TInput, entity: TEntity): number; // 0..1
  explain(input: TInput, entity: TEntity): string[];
}
```

### 3.2 Member-Matching (Reihenfolge)
1. **Strong Key**: `external_id` / `member_no` / eindeutige E-Mail.
2. **Semi-Strong**: `firstName + lastName + birthDate`.
3. **Fuzzy Name + Club Context**: normalisierte Namensähnlichkeit + Teamkontext.
4. **Manual Review Required** bei Score-Kollisionen.

Konfliktregeln:
- Zwei Kandidaten mit ähnlichem Score (`Δ < 0.05`) → `ambiguous_match`.
- E-Mail-Mismatch bei sonst starkem Treffer → Warnung + optionaler manueller Bestätigungsstatus.

### 3.3 Team-Matching
1. Exakte Normalform (`teamNameNormalized`).
2. Alias-Tabelle (`Herren I`, `H1`, `1. Herren`).
3. Liga-/Staffelkontext zur Entambiguierung.

### 3.4 Match-Matching
1. Exact Composite: `date + homeTeam + awayTeam (+ round optional)`.
2. Date±1 + TeamPair (bei Zeitzonen-/Formatdrift).
3. Gegner-basierter Fallback (`ownTeam + opponent + nearDate`).

---

## 4) QTTR/TTR- und Datums-Normalisierung

### 4.1 QTTR/TTR
- Inputs akzeptieren: `"1.734"`, `"1734"`, `"1,734"`, `"1734,0"`, `"-"`, `"n/a"`.
- Schritte:
  1. Trim + bekannte Nullmarker (`-`, `n/a`, leer) → `null`.
  2. Tausender-/Dezimaltrennzeichen heuristisch bereinigen.
  3. Integer-Cast für TTR/QTTR (Nachkommastellen runden oder verwerfen je Policy).
  4. Range-Check (z. B. `0..3500`), außerhalb → Warnung + `null`.
- Optionale Policies:
  - `strict`: invalid = Row Error.
  - `lenient` (Default): invalid = Field Warning.

### 4.2 Datumsfelder
- Unterstützte Eingaben:
  - ISO: `2026-03-31`
  - DMY: `31.03.2026`, `31/03/2026`
  - MDY (nur wenn Quelle so konfiguriert): `03/31/2026`
  - Excel serial date (z. B. `45375`)
  - Date+Time kombiniert (`2026-03-31 19:30`, `31.03.2026 19:30`)
- Normalisierung:
  - Interne Speicherung als ISO (`YYYY-MM-DD`) und optional `HH:mm`.
  - Timezone-sicher parsen (Default `Europe/Berlin` oder Club-Setting).
  - Unklare Formate (`01/02/2026`) nur mit Locale-Hint eindeutig, sonst Warnung.

---

## 5) Typen (TypeScript)

```ts
type Severity = 'info' | 'warning' | 'error';
type ImportEntity = 'member' | 'team' | 'match';
type ImportAction = 'insert' | 'update' | 'upsert' | 'skip';

interface RawRow {
  rowNumber: number;
  cells: Record<string, string | number | null>;
}

interface CanonicalRow {
  rowNumber: number;
  entity: ImportEntity;
  fields: Record<string, unknown>;
  mappingMeta: {
    matchedHeaders: Record<string, string>; // target -> source
    unmappedHeaders: string[];
  };
}

interface NormalizationIssue {
  rowNumber: number;
  field: string;
  severity: Severity;
  code:
    | 'invalid_format'
    | 'out_of_range'
    | 'missing_required'
    | 'ambiguous_date'
    | 'coerced_value';
  message: string;
}

interface MatchCandidate {
  entityId: string;
  score: number;
  strategy: string;
  reasons: string[];
}

interface MatchedRow {
  rowNumber: number;
  entity: ImportEntity;
  normalized: Record<string, unknown>;
  candidates: MatchCandidate[];
  selectedEntityId?: string;
  matchStatus: 'matched' | 'ambiguous' | 'unmatched';
}

interface PersistResult {
  rowNumber: number;
  action: ImportAction;
  success: boolean;
  entityId?: string;
  warnings: NormalizationIssue[];
  errors: NormalizationIssue[];
}

interface ImportReport {
  startedAt: string;
  finishedAt: string;
  sourceType: 'csv' | 'excel' | 'click-tt';
  entity: ImportEntity;
  totals: {
    rows: number;
    inserted: number;
    updated: number;
    upserted: number;
    skipped: number;
    warnings: number;
    errors: number;
  };
  byCode: Record<string, number>;
  rowResults: PersistResult[];
}
```

---

## 6) Import-Report (Output-Design)

### 6.1 UI-Zusammenfassung
- KPI-Karten: `Gesamt`, `Erfolgreich`, `Warnungen`, `Fehler`, `Übersprungen`.
- Fehlerfilter: nach `code`, Feld, Zeilennummer.
- Exportierbarer Report (`.json` und `.csv` mit Zeilenprotokoll).

### 6.2 Beispielregeln für Erfolg/Warnung/Fehler
- **Erfolg**: Row persisted (`insert/update/upsert`) ohne Errors.
- **Warnung**: persisted, aber mindestens eine degradierte Normalisierung.
- **Fehler**: row nicht persisted.
- **Teil-Erfolg**: Gesamtjob enthält sowohl Erfolge als auch Fehler.

---

## 7) Edge Cases

1. **Doppelte Header** (`Name`, `Name`) → suffix-basierte Disambiguierung + Warnung.
2. **Leere Zeilen zwischen Daten** → ignorieren, aber zählen als `skipped_blank`.
3. **Gemischte Delimiter in CSV** → Delimiter-Voting pro Datei, bei Unsicherheit Fatal Error.
4. **Excel mit mehreren Tabellen im Sheet** → nur zusammenhängender Datenblock ab Header.
5. **Formeln statt Werte in Excel** → cached value lesen, sonst Warnung.
6. **Unicode/Diakritika** (`Müller` vs `Mueller`) → Normalform für Match, Originalwert behalten.
7. **Namensinversion** (`Nachname, Vorname`) → Parser-Regel mit split/trim.
8. **Ambige Datumswerte** (`01/02/2026`) → locale-gebundene Auflösung, sonst row warning.
9. **QTTR/TTR als Text mit Suffix** (`1734 Punkte`) → Zahl extrahieren + Warnung.
10. **Teamalias-Konflikte** (`1. Herren` passt auf zwei Seasons) → season/phase Pflicht für Auto-Match.
11. **Match-Duplikate** (gleiches Composite Key) → policy: `skip` oder `update` konfigurierbar.
12. **Teilweise DB-Ausfälle** → retry pro Row (bounded), danach row error statt job abort.
13. **Constraint-Konflikte** (unique email) → row error + conflict payload im Report.
14. **Sehr große Dateien** → streaming parser + chunked execution (z. B. 500 Rows/Chunk).
15. **Fehlende Pflichtspalte global** → Early Validation Fail mit klarer Action-Hilfe.

---

## 8) Empfohlene Implementierungsreihenfolge
1. Canonical Parser + Header-Alias-Engine (CSV/Excel).
2. Normalizer-Bibliothek (TTR/QTTR, Date/Time, Nullmarker).
3. Match-Engine mit erklärbaren Scores.
4. Row-isolierter Executor + Retry/Conflict Handling.
5. Report-Backend + UI-Aufbereitung + Report-Export.
6. click-TT-Spezialadapter (auf Canonical Layer aufsetzen).
