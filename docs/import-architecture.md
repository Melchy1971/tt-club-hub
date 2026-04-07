# Import-Architektur (CSV / Excel / click-TT)

## 1) Parser-Design

### 1.1 Pipeline-Überblick

```text
Input-Datei -> SourceParser -> RawRows -> Mapping -> DomainDrafts -> Matching -> Validation -> Persist -> ImportReport
```

Jeder Schritt ist **fehlertolerant**: Zeilen/Records mit Problemen werden markiert und im Report gesammelt, ohne den gesamten Import abzubrechen.

### 1.2 Komponenten

- **SourceParser**
  - `CsvParser` (PapaParse)
  - `ExcelParser` (xlsx)
  - `ClickTtParser` (spezifisches Schema + Fallback-Mapping)
- **HeaderResolver**
  - normalisiert Header (`trim`, lowercase, Sonderzeichen entfernen)
  - ordnet Synonyme auf Canonical Fields
- **RowMapper**
  - konvertiert `RawRow` in typisierte `DomainDraft`-Objekte
  - enthält Feld-Mapper inkl. Datums-/Rating-Normalisierung
- **MatcherEngine**
  - sucht bestehende Entities (members, teams, matches) mit Strategie-Kaskade
- **Validator**
  - prüft Pflichtfelder, Wertebereiche, referenzielle Integrität
- **ImportExecutor**
  - führt Upsert/Create/Skip je Record aus
  - arbeitet in Batches, transaktional pro Batch oder pro Datensatz
- **ReportBuilder**
  - sammelt Erfolge, Warnungen, Fehler, Metriken

### 1.3 Partielle Fehlerbehandlung

Fehler werden auf drei Ebenen klassifiziert:

1. **File-Level** (fatal): Datei unlesbar, ungültiges Encoding, fehlende Tabellenblätter.
2. **Row-Level** (recoverable): ungültiges Datum, fehlender Pflichtwert in einer Zeile.
3. **Field-Level** (recoverable): einzelnes Feld unparsebar, Rest der Zeile nutzbar.

Strategie:

- Fataler File-Level-Fehler => Import endet sofort mit Report.
- Row-/Field-Level-Fehler => Zeile wird (je nach Schwere) als `failed` oder `partial` markiert, übrige Zeilen laufen weiter.
- Konfigurierbarer Schwellwert (`maxErrorRate`), z. B. Abbruch bei >30% fehlgeschlagenen Zeilen.

### 1.4 Format-Erkennung

- Dateiendung + MIME-Type + Sniffing kombinieren.
- CSV:
  - Delimiter auto-detect (`;`, `,`, `\t`)
  - UTF-8 mit BOM tolerant
- Excel:
  - erstes Blatt als Default, optional Blattwahl
- click-TT:
  - Schema-basierte Erkennung über charakteristische Header (z. B. `QTTR`, `Mannschaft`, `Spieltag`)

---

## 2) Mapping-Regeln

### 2.1 Canonical Fields

Gemeinsames internes Schema:

- **Member**: `externalId`, `firstName`, `lastName`, `club`, `birthDate`, `gender`, `ttr`, `qttr`, `ratingDate`
- **Team**: `externalId`, `name`, `club`, `league`, `season`
- **Match**: `externalId`, `homeTeam`, `awayTeam`, `matchDate`, `result`, `round`, `season`

### 2.2 Header-Synonyme (Beispiele)

- `vorname`, `first_name`, `first name` -> `firstName`
- `nachname`, `last_name`, `surname` -> `lastName`
- `qttr`, `q-ttr` -> `qttr`
- `ttr`, `rating` -> `ttr`
- `datum`, `date`, `spieltag`, `match_date` -> kontextabhängig (`ratingDate` oder `matchDate`)

### 2.3 Match-Strategien

#### Members

1. `externalId` exakt
2. `(firstName,lastName,birthDate,club)` exakt
3. `(firstName,lastName,club)` + Fuzzy-Score >= Schwelle
4. sonst: neuer Member + Warnung `LOW_CONFIDENCE_MATCH`

#### Teams

1. `externalId` exakt
2. `(club,name,season)` exakt
3. normalisierter Name (`ttc köln 1` == `TTC Koeln I`) + League-Fallback

#### Matches

1. `externalId` exakt
2. `(homeTeam,awayTeam,matchDate,season)` exakt
3. swapped-team-check + Resultatsgleichheit (wenn Quellen vertauschen)

### 2.4 Konfliktauflösung

- Priorität der Quelle konfigurierbar (`click-TT > Excel > CSV` oder umgekehrt)
- `last-write-wins` nur für nicht-kritische Felder
- kritische Konflikte (z. B. Birthdate-Änderung) => Warnung/Review-Flag statt blindem Überschreiben

---

## 3) Typen (Domain + Import)

Siehe `src/import/types.ts`.

Kernideen:

- `ImportSeverity` für `info|warning|error|fatal`
- `ImportIssue` mit Kontext (`rowIndex`, `field`, `code`, `message`)
- `RowImportResult<T>` für `success|partial|failed|skipped`
- `ImportReport` aggregiert Metriken + Issues + Laufzeiten

---

## 4) QTTR/TTR- und Datums-Normalisierung

### 4.1 Rating-Felder

- Eingaben wie `1.734`, `1734`, `1,734` robust parsen
- nur Integer-Werte im validen Bereich (z. B. `500..3000`) akzeptieren
- `qttr` und `ttr` getrennt halten, aber gemeinsame Normalisierungsfunktion nutzen
- bei Ambiguität (`17,34`) => Fehler `AMBIGUOUS_RATING`

### 4.2 Datumsfelder

Akzeptierte Formate (konfigurierbar):

- ISO: `YYYY-MM-DD`
- Deutsch: `DD.MM.YYYY`
- Slash: `DD/MM/YYYY`, `MM/DD/YYYY` (nur mit Locale-Hinweis eindeutig)
- Excel serial date (numerisch)

Normalisierung:

- intern als ISO-Datum (`YYYY-MM-DD`) speichern
- timezone-neutral als Kalenderdatum behandeln (keine stillen UTC-Verschiebungen)
- ungültige Daten (`31.02.2026`) => `INVALID_DATE`

---

## 5) Import-Report

### 5.1 Report-Struktur

- Meta: Datei, Typ, Start/Ende, Dauer
- Counts:
  - `totalRows`
  - `successfulRows`
  - `partialRows`
  - `failedRows`
  - `skippedRows`
- Issues nach Severity + Code gruppiert
- Sample-Probleme (erste N Zeilen pro Fehlercode)
- Optional: `created/updated/unchanged` pro Entity-Typ

### 5.2 Report-Ausgabe

- JSON für API/Debug
- UI-Summary für Admins:
  - „120 importiert, 8 Warnungen, 3 Fehler“
- CSV-Error-Export für Korrekturschleife

---

## 6) Edge Cases

- Leere Datei / nur Header
- Doppelte Header oder unbekannte Spalten
- Misch-Encoding (UTF-8/Latin1)
- Zahlen mit Tausender-/Dezimaltrennzeichen je Locale
- Excel-Formeln statt Werte
- Namensvarianten (`Müller` vs `Mueller`, `ß` vs `ss`)
- Teamumbenennung über Saisons hinweg
- Matches doppelt importiert aus mehreren Quellen
- Fehlende Referenzen (Match verweist auf unbekanntes Team)
- Teilweise korrupte Zeilen (zu viele/zu wenige Spalten)
- click-TT-spezifische Sonderfälle (abgebrochene Spiele, kampflos)

---

## 7) Minimaler Implementierungsfahrplan

1. `types.ts` + `ImportReport` fertigstellen.
2. CSV + Excel Parser vereinheitlichen (`RawRow[]`).
3. HeaderResolver + Mapping-Regeln (inkl. QTTR/TTR + Datum).
4. MatcherEngine (members -> teams -> matches).
5. ReportBuilder + UI-Anzeige.
6. click-TT Adapter ergänzen und mit echten Exporten testen.

---

## 8) Vertiefende Fachlogik

Für die fachliche Trennung zwischen member-basiertem QTTR/TTR-Update und match-basiertem Pin/Code-Update siehe:

- `docs/architecture/import-update-strategy-pin-code-qttr-ttr-2026-04-07.md`
