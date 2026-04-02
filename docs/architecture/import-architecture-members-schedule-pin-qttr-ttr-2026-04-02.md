# Import-Architektur: Mitglieder, Spielplan, PIN/Code, QTTR/TTR

## Scope & Zielbild
Diese Architektur beschreibt einen robusten Import-Flow für vier Zielbereiche:

1. **Mitglieder** (`members`)
2. **Spielplan/Begegnungen** (`matches`, optional inkl. Teamzuordnung)
3. **PIN/Code** (z. B. Match-PIN, Zugangscode, Bulk-PIN-Import)
4. **Leistungswerte** (**QTTR/TTR**) als Member- oder Match-nahe Daten

Ziel ist eine **fehlertolerante** Verarbeitung von **CSV**, **Excel** und **click-TT**-Exports mit:
- stabiler Parsing-Strategie,
- reproduzierbarer Normalisierung,
- partieller Fehlerbehandlung (kein Komplettabbruch bei Einzelzeilenfehlern),
- erklärbaren Match-Entscheidungen,
- transparentem Import-Report.

---

## 1) Parser-Design

## 1.1 Ingestion-Layer (Format-spezifisch)

### A) CSV Reader
- Auto-Detection für Delimiter (`;`, `,`, `\t`) über Stichprobe.
- BOM-Strip (`UTF-8 BOM`).
- Header-Zeile per Heuristik: erste Zeile mit >50 % textuellen Spaltennamen.
- Leere Zeilen und Kommentarzeilen (`#`, `//`) optional skippen.

### B) Excel Reader (`.xlsx`, `.xls`)
- Standard: erstes nicht-leeres Sheet; optional explizite Sheet-Wahl.
- Header-Inferenz in den ersten `N` Zeilen (Default 10).
- Formelzellen: `cachedValue` bevorzugen, sonst Warnung.
- Excel-Seriendatum konvertieren (inkl. 1900-Leap-Bug-Korrektur).

### C) click-TT Reader
- Vordefinierte Import-Profile je Exporttyp (z. B. Mannschaftsmeldung, Spielplan).
- Alias-Bibliothek für bekannte click-TT-Bezeichner (`Q-TTR`, `Verein`, `Heim`, `Gast`, `Spieltag`).
- Versions-Toleranz via synonymen Header-Sets.

---

## 1.2 Canonical Pipeline

```ts
read(source) -> RawTable
mapHeaders(rawTable, mappingProfile) -> CanonicalTable
normalize(canonicalRows, normalizerPolicy) -> NormalizedRows
validate(normalizedRows, schemaByEntity) -> ValidatedRows
match(validatedRows, matchContext, strategyChain) -> MatchDecisionRows
persist(matchRows, executionMode) -> PersistResults
report(allStages) -> ImportReport
```

**Designprinzip:** Jeder Schritt erzeugt eigene Issues (`warning`/`error`) mit `rowNumber`, `field`, `code`, `message`.

---

## 1.3 Parser-Komponenten (Empfehlung)

- `SourceAdapter` (`csv`, `excel`, `click-tt`)
- `HeaderResolver` (Alias + Fuzzy + manueller Override)
- `CanonicalMapper` (Entity-spezifische Feldprojektion)
- `Normalizer` (Datums-, Namens-, QTTR/TTR-, PIN/Code-Normalisierung)
- `EntityValidator` (Pflichtfelder, Werteranges, Konsistenz)
- `Matcher` (members/teams/matches)
- `Executor` (row-isoliert, retry-fähig)
- `ImportReporter` (Summary + Zeilenprotokoll)

---

## 2) Mapping-Regeln

## 2.1 Header-Alias-Mapping

### Members
- `firstName`: `Vorname`, `First Name`, `firstname`, `first_name`
- `lastName`: `Nachname`, `Last Name`, `lastname`, `last_name`
- `email`: `E-Mail`, `Mail`, `email`
- `birthDate`: `Geburtsdatum`, `DOB`, `birth_date`
- `ttr`: `TTR`, `TTR-Punkte`, `TTR Punkte`
- `qttr`: `QTTR`, `Q-TTR`, `qttr_rating`
- `memberNo`: `Mitgliedsnummer`, `ID`, `member_no`

### Schedule/Matches
- `matchDate`: `Datum`, `date`, `Spieltag-Datum`
- `startTime`: `Uhrzeit`, `Start`, `time`
- `homeTeam`: `Heim`, `Heimmannschaft`, `home_team`
- `awayTeam`: `Gast`, `Gastmannschaft`, `away_team`
- `opponent`: `Gegner`, `Opponent`
- `round`: `Runde`, `Spieltag`, `match_day`
- `result`: `Ergebnis`, `result`

### PIN/Code
- `pinCode`: `PIN`, `Code`, `Match-PIN`, `Freigabecode`
- `pinType`: `PIN-Typ`, `Code-Typ`
- `validFrom`: `Gültig ab`, `valid_from`
- `validUntil`: `Gültig bis`, `valid_until`
- `target`: `Match`, `Team`, `Mitglied` (Kontextziel)

---

## 2.2 Feld-Priorität
1. **UI-Manuelles Mapping** (höchste Priorität)
2. **Explizite Alias-Regel**
3. **Fuzzy Header Match** (Confidence >= 0.88)
4. **Unmapped** + Warnung

---

## 2.3 Pflichtfelder je Entity

- `member`: (`email` **oder** `memberNo` **oder** `firstName+lastName+birthDate`)
- `match`: `matchDate` + (`homeTeam+awayTeam` **oder** `team+opponent`)
- `pinCode`: `pinCode` + eindeutiger Kontext (`matchId` oder matchbare Match-Composite-Infos)
- `rating` (QTTR/TTR-only import): mindestens ein Personenschlüssel + ein Ratingfeld

---

## 3) Match-Strategien

## 3.1 Members

Strategie-Kette (absteigend):
1. `memberNo` exact
2. `email` exact (case-insensitive)
3. `firstName+lastName+birthDate` exact nach Normalisierung
4. Fuzzy Name + Verein/Team-Kontext + optional Jahrgang

Konfliktregeln:
- Zwei Top-Kandidaten mit Score-Differenz `< 0.05` => `ambiguous_member`
- Email-Konflikt bei starkem Namensmatch => Warnung `member_email_conflict`

---

## 3.2 Teams
1. Normalisierter Teamname exact (`Herren 1`, `1. Herren` -> gleiche Normalform)
2. Alias-Tabelle
3. Liga/Staffel + Saisonphase als Tie-Breaker

---

## 3.3 Matches
1. Composite exact: `date + homeTeam + awayTeam (+ round)`
2. Tolerant: `date ±1 Tag` + Team-Paar
3. Fallback: `ownTeam + opponent + nearDate`

Konflikt: Mehrdeutigkeit in mehreren Seasons -> `season_required_for_matching` (row error oder manual review).

---

## 4) Normalisierung

## 4.1 Datumsnormalisierung

Akzeptierte Inputs:
- ISO: `2026-04-02`
- DMY: `02.04.2026`, `02/04/2026`
- MDY nur bei Quell-Locale-Hint
- Excel serial (`45377`)
- Datetime kombiniert (`2026-04-02 19:30`, `02.04.2026 19:30`)

Regeln:
- intern `YYYY-MM-DD` und optional `HH:mm`.
- unklare Formate (`01/02/2026`) ohne Locale => Warnung `ambiguous_date`, Feld `null`.
- Zeitzone über Club-Setting, default `Europe/Berlin`.

---

## 4.2 QTTR/TTR-Normalisierung

Akzeptiert: `1734`, `1.734`, `1,734`, `1734.0`, `1734 Punkte`, `-`, `n/a`.

Pipeline:
1. Trim + Nullmarker (`-`, `n/a`, leer) => `null`
2. Numerische Extraktion und Separator-Heuristik
3. In Integer überführen (Policy: round/floor/reject)
4. Range-Check (z. B. `0..3500`)

Policy:
- `strict`: ungültig => row error
- `lenient` (Default): ungültig => warning + Feld auf `null`

---

## 4.3 Namensnormalisierung

- Unicode NFKC, Mehrfachspaces reduzieren, Trim.
- Diakritika-Fallback-Key (`Müller` ~ `Mueller`) nur für Matching.
- Vergleich case-insensitive; Originalschreibweise bleibt persistiert.
- Erkennung `Nachname, Vorname` bei Kommaformaten.

---

## 4.4 PIN/Code-Normalisierung

- Trim + Entfernen unsichtbarer Zeichen.
- Uppercase-Kanonisierung (wenn Domain-Regel das verlangt).
- Formatvalidierung per Regex (z. B. `^[A-Z0-9]{4,12}$`).
- Optionale Prüfziffernlogik.
- Ablaufzeit prüfen (`validUntil < now`) => warning oder reject je Policy.

---

## 5) Partielle Fehlerbehandlung (ohne Komplettabbruch)

## 5.1 Fehlerklassen
- **Fatal (job-level):** Datei unlesbar, kein Header, strukturell unbrauchbar.
- **Row Error:** Pflichtfeld fehlt, kein Match möglich, DB-Constraint verletzt.
- **Field Warning:** Formatproblem mit Fallback, unsicheres Match, Range-Korrektur.

## 5.2 Transaktionsmodell
- **Row-isolierte Persistenz** (empfohlen) oder Chunk + Savepoints.
- Retry nur für technische Fehler (`deadlock`, temporäre Verbindung), max. `n=2`.
- Fachliche Fehler nie blind retryn.

## 5.3 Verhalten bei Konflikten
- `upsert` nur mit klarer Schlüssellogik.
- Ambige Matches auf `manual_review` setzen statt falscher Auto-Updates.
- Optional `dryRun` für Vorschau ohne Persistenz.

---

## 6) Typen (TypeScript)

```ts
type ImportSource = 'csv' | 'excel' | 'click-tt';
type ImportEntity = 'member' | 'team' | 'match' | 'pinCode' | 'rating';
type Severity = 'info' | 'warning' | 'error';
type ImportAction = 'insert' | 'update' | 'upsert' | 'skip' | 'manual_review';

type IssueCode =
  | 'missing_required'
  | 'invalid_format'
  | 'out_of_range'
  | 'ambiguous_date'
  | 'ambiguous_member'
  | 'season_required_for_matching'
  | 'member_email_conflict'
  | 'pin_format_invalid'
  | 'constraint_conflict'
  | 'coerced_value';

interface ImportIssue {
  rowNumber: number;
  field?: string;
  severity: Severity;
  code: IssueCode;
  message: string;
}

interface CanonicalRow {
  rowNumber: number;
  entity: ImportEntity;
  raw: Record<string, unknown>;
  mapped: Record<string, unknown>;
  issues: ImportIssue[];
}

interface MatchCandidate {
  id: string;
  score: number; // 0..1
  strategy: string;
  reasons: string[];
}

interface MatchDecisionRow {
  rowNumber: number;
  entity: ImportEntity;
  normalized: Record<string, unknown>;
  candidates: MatchCandidate[];
  selectedId?: string;
  actionProposal: ImportAction;
  issues: ImportIssue[];
}

interface PersistResult {
  rowNumber: number;
  success: boolean;
  action: ImportAction;
  entityId?: string;
  issues: ImportIssue[];
}

interface ImportReport {
  source: ImportSource;
  entity: ImportEntity;
  startedAt: string;
  finishedAt: string;
  totals: {
    rows: number;
    success: number;
    warnings: number;
    errors: number;
    inserted: number;
    updated: number;
    skipped: number;
    manualReview: number;
  };
  byCode: Record<IssueCode, number>;
  rows: PersistResult[];
}
```

---

## 7) Import-Report (Erfolg/Warnung/Fehler)

## 7.1 Reporting-Regeln
- **Erfolg**: Persistiert ohne Fehler (`error=0`), Warnungen erlaubt.
- **Warnung**: Persistiert, aber mindestens eine `warning`.
- **Fehler**: Nicht persistiert oder nur `manual_review`.

## 7.2 Empfohlene Ausgabe
- Summary-Kacheln: `Rows`, `Success`, `Warnings`, `Errors`, `Manual Review`.
- Drilldown pro Zeile inkl. `raw -> mapped -> normalized`.
- Export: `report.json` + `report.csv`.

---

## 8) Edge Cases (Pflichtkatalog)

1. **Doppelte Header** (`Code`, `Code`) -> suffix + Warnung.
2. **Leere Zwischenzeilen** -> `skip_blank`.
3. **Gemischte CSV-Delimiter** -> Konsistenzprüfung, ggf. fatal.
4. **Excel-Merge-Cells** im Header -> Fill-Forward nur im Headerbereich.
5. **Formeln ohne cached values** -> warning + Feld `null`.
6. **Ungültige PINs** (`***`, zu kurz/lang) -> row error oder manual review.
7. **PIN-Duplikate** für selben Matchkontext -> conflict policy (`keep-first`, `replace`, `reject`).
8. **Namensinversion** (`Meier, Anna`) -> Parser-Split.
9. **Doppelte Mitglieder** (gleiches `memberNo`, unterschiedliche Mail) -> conflict warning.
10. **QTTR/TTR mit Textsuffix** (`1720 Punkte`) -> coercion warning.
11. **Ambiges Datum** ohne Locale (`01/02/2026`) -> warning + null.
12. **Match über Mitternacht** (Start 23:30, Ende 00:30) -> Date-Rollover-Regel.
13. **Saisonwechsel** (gleiches Teamlabel in 2 Saisons) -> season mandatory for auto-match.
14. **Sehr große Dateien** (>100k Rows) -> Streaming + Chunk-Flush + Backpressure.
15. **Teil-DB-Ausfall** -> row-level retry, restliche Rows laufen weiter.

---

## 9) Implementierungsreihenfolge

1. HeaderResolver + Mapping-UI + CanonicalRow.
2. Normalizer (Date/Name/QTTR/TTR/PIN).
3. Match-Engine (member/team/match) mit explainable scoring.
4. Row-isolierter Executor + dryRun.
5. Import-Report + CSV/JSON-Export.
6. click-TT Profile pro Exportvariante ergänzen.

So entsteht ein Importsystem, das sowohl robust für Massenimporte als auch transparent für Fachanwender:innen bleibt.
