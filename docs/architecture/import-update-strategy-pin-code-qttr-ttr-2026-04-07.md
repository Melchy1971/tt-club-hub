# Import-Update-Strategie: QTTR/TTR und Pin/Code

## Zielbild

Der Import wird fachlich in zwei getrennte Update-Prozesse aufgeteilt:

- **QTTR/TTR-Import** aktualisiert bestehende oder matchbare `members`.
- **Pin/Code-Import** aktualisiert bestehende oder matchbare `matches`.

Beide Prozesse verwenden dieselbe technische Pipeline (`parse -> map -> normalize -> match -> validate -> persist -> report`), aber unterschiedliche **Match-Anker**, **Konfliktregeln** und **Audit-Ereignisse**.

Die Kernregel lautet:

- **Ratingdaten sind member-zentriert.**
- **Pin/Code-Daten sind match-zentriert.**
- **Unsichere Zuordnungen werden nie stillschweigend persistiert.**

---

## 1. Update-Strategien

## 1.1 QTTR/TTR als member-basierter Update-Prozess

### Primärer Zweck

Ein QTTR/TTR-Import darf keine neuen fachlich unklaren Personen erzeugen, wenn die Quelle erkennbar nur Leistungswerte liefern soll. Standardmodus ist deshalb:

- `match-existing-member -> update-rating-fields`
- kein stilles `create-member`

### Erlaubte Aktionen pro Zeile

1. `update`
   Vorhandenes Mitglied wurde eindeutig identifiziert, mindestens eines der Rating-Felder ändert sich.
2. `unchanged`
   Mitglied wurde eindeutig identifiziert, importierter QTTR/TTR-Wert ist identisch zum Bestand.
3. `skip`
   Zeile enthält nur Null-/Leer-/Platzhalterwerte oder keine fachlich verwertbare Änderung.
4. `manual_review`
   Match ist nicht eindeutig oder Konflikt betrifft identitätsrelevante Felder.
5. `error`
   Pflichtschlüssel oder Ratingwert fachlich ungültig.

### Update-Regeln für Felder

- `qttr` und `ttr` werden unabhängig voneinander behandelt.
- Ein fehlender QTTR-Wert darf einen vorhandenen TTR-Wert nicht überschreiben und umgekehrt.
- `ratingDate` wird nur aktualisiert, wenn mindestens ein Rating-Feld fachlich akzeptiert wurde.
- `null` aus der Quelle löscht bestehende Ratings standardmäßig nicht.
- Explizites Löschen ist nur in einem späteren Admin-Modus mit eigener Policy zulässig, nicht im Standardimport.

### Erlaubte Schlüsselfelder für Member-Updates

Priorisierte Identifikationskette:

1. `member_number` oder anderes stabiles externes Personenkennzeichen
2. `email` exact, falls im Verein als verlässlicher Identifier zugelassen
3. `first_name + last_name + date_of_birth`
4. `first_name + last_name + club`
5. `first_name + last_name + team_context + birth_year`

Wenn nur Name ohne Zusatzkontext vorliegt, ist ein automatisches Update nur erlaubt, wenn exakt ein plausibler Kandidat existiert.

### Konfliktregel

- Änderungen an `first_name`, `last_name`, `date_of_birth`, `member_number` oder `email` werden durch einen QTTR/TTR-Import nicht automatisch zurückgeschrieben.
- Solche Abweichungen erzeugen `manual_review`, nicht `update`.

---

## 1.2 Pin/Code als match-basierter Update-Prozess

### Primärer Zweck

Ein Pin/Code-Import aktualisiert Felder, die fachlich an eine Begegnung gebunden sind. Der Datensatzanker ist deshalb immer `match`.

### Erlaubte Aktionen pro Zeile

1. `update`
   Match wurde eindeutig identifiziert und mindestens `pin` oder `code` ändert sich.
2. `unchanged`
   Match wurde eindeutig identifiziert, Werte entsprechen dem Bestand.
3. `skip`
   Zeile ist fachlich leer oder enthält nur Platzhalter.
4. `manual_review`
   Match-Kontext ist mehrdeutig, saisonübergreifend nicht eindeutig oder Teams wurden unscharf aufgelöst.
5. `error`
   Kein matchbarer Match-Schlüssel oder ungültiges Pin-/Code-Format.

### Update-Regeln für Felder

- `pin` und `code` werden getrennt bewertet und geschrieben.
- Leerer `pin` darf einen vorhandenen `code` nicht beeinflussen und umgekehrt.
- `null` oder Platzhalterwerte aus der Quelle löschen bestehende Werte standardmäßig nicht.
- Wenn Quelle beide Felder liefert, dürfen beide in einem Audit-Ereignis zusammengeführt werden.
- Wenn Quelle nur ein Feld liefert, ist das andere Feld als `unchanged` zu behandeln.

### Erlaubte Match-Schlüssel

Priorisierte Identifikationskette:

1. explizite `match_id` oder stabiles `external_match_id`
2. `season + round + home_team + away_team + match_date`
3. `season + own_team + opponent + is_home + match_date`
4. `season + own_team + opponent + round`
5. `team_context + opponent + near_date_window`

Ein automatisches Update ohne `season` ist nur zulässig, wenn innerhalb aller aktiven Saisons genau ein Match-Kandidat existiert.

### Konfliktregel

- Wenn mehrere Matches mit identischem Team-Paar in engem Zeitfenster existieren, gewinnt nie der erste Treffer; die Zeile geht auf `manual_review`.
- Wenn `pin` oder `code` bereits belegt sind und ein anderer Wert importiert wird, ist das erlaubt, aber auditpflichtig als sensitives Feld-Update.

---

## 2. Matching-Regeln

## 2.1 Normalisierte Vergleichsschlüssel

Vor jedem Match werden Vergleichsschlüssel erzeugt:

- `normalized_name`: lowercase, trim, Mehrfachspaces entfernt
- `ascii_name_key`: Umlaute/Diakritika/`ß` auf ASCII-Fallback reduziert
- `team_key`: Teamname ohne Satzzeichen, Roman-/Arabisch-Varianten harmonisiert
- `date_key`: ISO-Datum ohne Zeitzonenverschiebung
- `empty_marker`: Kennzeichnung, ob Eingabe leer oder Platzhalter war

Beispiel:

- `Müller`, `Mueller`, `muller` teilen einen Match-Key für Fuzzy-Vergleich, nicht aber zwingend für Persistenz.
- `TTC Köln I`, `TTC Koeln 1`, `ttc koln 1` teilen einen Team-Key.

## 2.2 Unscharfe Namenszuordnung für Mitglieder

Fuzzy-Matching ist nur als nachgelagerter Resolver erlaubt, nie als erster Match-Schritt.

### Bewertungsdimensionen

1. Nachname-Gewichtung höher als Vorname.
2. Exakter Geburtsjahr-Treffer erhöht Score deutlich.
3. Club- oder Team-Kontext erhöht Score.
4. Vollständiger Vorname schlägt Initialenmatch.
5. Identische externe Kennung sticht jeden Fuzzy-Score.

### Entscheidungsregel

- Auto-Match nur bei Score oberhalb Schwellwert und eindeutiger Dominanz zum zweitbesten Kandidaten.
- Empfehlung:
  - `accept >= 0.93`
  - `manual_review` bei `0.85..0.92`
  - `reject < 0.85`
- Zusätzlich: Differenz zum zweitbesten Kandidaten mindestens `0.05`.

### Spezielle Namensregeln

- `Nachname, Vorname` wird vor der Fuzzy-Bewertung in Standardreihenfolge transformiert.
- Doppelnamen und Namenszusätze (`von`, `de`, `jun.`, `sr.`) werden für Vergleich und Persistenz getrennt behandelt.
- Initialen wie `M. Schneider` dürfen nur mit Zusatzkontext auto-matchen.

## 2.3 Team-Kontext für Member-Matching

Wenn QTTR/TTR aus einer Mannschaftsliste stammt, darf `team_context` als Tie-Breaker genutzt werden:

- Team aus Quelle normalisieren
- aktuelle Teamzuordnung des Mitglieds in relevanter Saison prüfen
- nur Kandidaten mit passender Teamzuordnung bevorzugen

Wenn der Team-Kontext der Quelle zu keiner bekannten Saisonzuordnung passt, bleibt das Mitgliedsmatch möglich, aber mit Warnung `TEAM_CONTEXT_MISMATCH`.

## 2.4 Match-Kontext für Pin/Code-Matching

Pin/Code-Importe arbeiten primär gegen Match-Kontext:

- Heim-/Gast-Logik normalisieren
- eigenes Team gegen Vereins-Taxonomie auflösen
- Gegnername normalisieren
- Datum und Spieltag gemeinsam bewerten

### Swapped-Team-Regel

Wenn Quelle Heim/Gast vertauscht liefert, ist ein Auto-Match nur erlaubt, wenn zusätzlich mindestens eine der folgenden Bedingungen erfüllt ist:

- `is_home` ist explizit vorhanden und konsistent korrigierbar
- Gegnerpaar ist in derselben Saison nur einmal vorhanden
- `round` oder `match_day` bestätigt denselben Datensatz

Sonst: `manual_review`.

## 2.5 Null-, Leer- und Platzhalterwerte

Alle Importarten verwenden dieselbe Null-Policy.

### Als fachlich leer behandeln

- `null`, `undefined`
- leere Strings und Whitespace-only
- `-`, `--`, `---`
- `n/a`, `na`, `k.a.`, `keine`, `unbekannt`
- `0` nur dann, wenn Feld fachlich kein gültiger Wert sein kann

### Feldspezifische Regeln

- QTTR/TTR: `0` ist in der Regel ungültig und wird zu `null` plus Warning.
- Pin/Code: `0000` oder `000000` ist nur dann Platzhalter, wenn dies pro Quelle explizit konfiguriert ist.
- Datumsfelder: leere oder Platzhalterwerte führen nicht zu implizitem Löschupdate.

### Persistenzregel

- Leere Eingaben bedeuten standardmäßig `no-op`, nicht `clear-field`.
- Nur explizite Delete-Importe dürfen Löschungen durchführen.

---

## 3. Fehlermodell

## 3.1 Fehlerkategorien

### Job-Level

- `UNSUPPORTED_FILE`
- `MISSING_HEADER_ROW`
- `INVALID_SHEET_SELECTION`
- `HEADER_MAPPING_INCOMPLETE`

### Row-Level

- `MISSING_MATCH_KEY`
- `MISSING_MEMBER_KEY`
- `NO_MATCH_CANDIDATE`
- `AMBIGUOUS_MATCH`
- `AMBIGUOUS_MEMBER`
- `CONTEXT_CONFLICT`
- `PERSISTENCE_ERROR`

### Field-Level

- `INVALID_RATING`
- `AMBIGUOUS_RATING`
- `INVALID_PIN`
- `INVALID_CODE`
- `INVALID_DATE`
- `AMBIGUOUS_DATE`
- `PLACEHOLDER_IGNORED`
- `TEAM_CONTEXT_MISMATCH`

## 3.2 Ergebniszustände je Zeile

- `updated`
- `unchanged`
- `skipped`
- `manual_review`
- `failed`

`partial` ist nur dann sinnvoll, wenn eine Zeile mehrere fachliche Teilupdates tragen kann, z. B. `pin` erfolgreich, `code` verworfen. Für die UI reicht meist trotzdem ein Hauptstatus plus Feld-Issues.

## 3.3 Bewertungslogik

- `failed`: keine Persistenz, mindestens ein blockierender Fehler
- `manual_review`: keine Persistenz, aber technisch verarbeitbar
- `skipped`: bewusst keine Persistenz, weil keine fachliche Änderung vorliegt
- `unchanged`: Persistenz optional entfallen, Match war erfolgreich
- `updated`: Persistenz erfolgreich

## 3.4 Empfehlung für Fehlerobjekt

Zusätzlich zu vorhandenem `ImportIssue` sollten für erklärbares Matching ergänzt werden:

- `entityType`
- `actionProposed`
- `matchStrategy`
- `candidateCount`
- `selectedEntityId`
- `beforeValue`
- `afterValue`
- `normalizedValue`

Damit kann später im Report gezeigt werden, warum eine Zeile aktualisiert, übersprungen oder zur Prüfung gestellt wurde.

---

## 4. Audit-Hinweise

## 4.1 Audit-Ziele

Der Import muss nachvollziehbar machen:

- welche Zeile welchen Datensatz getroffen hat
- mit welcher Matching-Strategie die Zuordnung entstand
- welche Felder sich geändert haben
- welche Felder absichtlich nicht geändert wurden
- welche Zeilen wegen Unsicherheit nicht persistiert wurden

## 4.2 Empfohlene Audit-Felder pro Persistenzereignis

- `import_job_id`
- `source_type`
- `source_file_name`
- `row_index`
- `entity_type`
- `entity_id`
- `action` (`updated`, `unchanged`, `skipped`, `manual_review`, `failed`)
- `match_strategy`
- `match_confidence`
- `raw_payload`
- `normalized_payload`
- `field_changes`
- `actor_user_id`
- `performed_at`

## 4.3 Field-Change-Format

Für `field_changes` ist ein strukturierter Diff sinnvoll:

```json
[
  {
    "field": "qttr",
    "before": 1512,
    "after": 1538,
    "source": "click-tt",
    "reason": "member-rating-update"
  }
]
```

Für Pin/Code sollte zusätzlich markiert werden, dass es sich um sensible operative Felder handelt.

## 4.4 Audit bei Nicht-Persistenz

Auch `manual_review`, `failed` und `skipped` sollten protokolliert werden, mindestens mit:

- Grundcode
- Kandidatenanzahl
- Top-Kandidaten-Scores
- erkannte Placeholder-/Null-Behandlung

So bleibt später nachvollziehbar, warum ein erwartetes Update nicht stattgefunden hat.

## 4.5 Datenschutz und Sichtbarkeit

- Vollständige Rohzeilen nur für Admin-/Import-Audit sichtbar machen.
- Pin/Code-Werte im Audit-UI maskieren, im technischen Audit-Log je nach Berechtigung verschlüsselt oder gehasht ablegen.
- QTTR/TTR-Änderungen sind fachlich weniger sensitiv, sollten aber trotzdem mit Vorher-/Nachher-Wert dokumentiert werden.

---

## 5. Edge Cases

## 5.1 QTTR/TTR

- Ein Mitglied erscheint mehrfach in derselben Datei mit verschiedenen Ratings.
  Regel: letzte fachlich gültige Zeile gewinnt nur innerhalb desselben Imports, frühere Zeilen bleiben im Report sichtbar.
- QTTR und TTR widersprechen sich fachlich oder stammen von verschiedenen Stichtagen.
  Regel: Werte getrennt behandeln, `ratingDate` je Quelle sauber ableiten oder Warnung `RATING_DATE_CONFLICT`.
- Namen wurden nach Hochzeit/Umbenennung geändert.
  Regel: alter Name nur mit Zusatzkontext auto-matchen.
- Geschwister oder Namensdopplungen im selben Verein.
  Regel: ohne Geburtsdatum, Mitgliedsnummer oder Teamkontext kein Auto-Update.

## 5.2 Pin/Code

- Dasselbe Team spielt in kurzer Folge zweimal gegen denselben Gegner.
  Regel: ohne Spieltag oder eindeutiges Datum kein Auto-Match.
- Verlegte Spiele liegen außerhalb des ursprünglichen Spieltags.
  Regel: Match-Resolver muss aktuelles Match-Datum aus Bestand gegen Rundenkontext abwägen, nicht nur Rohdatum.
- Quelle liefert nur Gegnername und PIN, aber kein Heim/Gast.
  Regel: nur auto-matchen, wenn genau ein offenes Match in relevantem Kontext existiert.
- Match wurde abgesagt oder kampflos gewertet.
  Regel: Import in solche Matches nur, wenn Status-Policy dies zulässt, sonst `CONTEXT_CONFLICT`.

## 5.3 Quellen- und Datenqualitätsprobleme

- Header doppelt oder sprachlich gemischt.
- Excel-Zellen enthalten Formeln oder unsichtbare Leerzeichen.
- CSV mischt `;` und `,` oder liefert abgeschnittene Spalten.
- `pin` oder `code` enthalten führende Nullen und dürfen nicht numerisch normalisiert werden.
- QTTR/TTR-Werte enthalten Tausendertrennzeichen, Textsuffixe oder Dezimalkommas.

## 5.4 Idempotenz und Wiederholungsimporte

- Reimport derselben Datei darf keine zusätzlichen Änderungen erzeugen, wenn keine Werte differieren.
- Audit muss trotzdem zeigen, dass die Datei verarbeitet wurde.
- Optional: Datei-Hash oder Zeilen-Hash speichern, um Dubletten und Wiederholungsimporte schneller erkennbar zu machen.

---

## 6. Konkrete Empfehlungen für die Implementierung

1. QTTR/TTR-Import als eigenen `member-rating-import`-Modus modellieren, nicht als generischen Member-Upsert.
2. Pin/Code-Import als eigenen `match-pin-code-import`-Modus modellieren, nicht als generischen Match-Upsert.
3. Eine zentrale `NullValuePolicy` für Platzhalter und Leerwerte einführen.
4. Matching-Ergebnisse als erklärbare `MatchDecision` mit Score, Strategie und Kandidatenliste speichern.
5. Bei Unsicherheit strikt `manual_review` statt heuristischem Blindupdate verwenden.
6. Audit-Events für `updated`, `unchanged`, `skipped`, `manual_review` und `failed` gleichermaßen vorsehen.

## 7. Abgrenzung der Verantwortlichkeiten

- **HeaderResolver**: erkennt Quellfelder und Platzhalterspalten.
- **Normalizer**: bereitet Werte und Vergleichsschlüssel auf.
- **Matcher**: entscheidet nur Zuordnung, nicht Feldüberschreibungen.
- **UpdatePolicy**: entscheidet pro Feld, ob geschrieben, ignoriert oder geprüft wird.
- **AuditWriter**: schreibt Job-, Row- und Field-Diffs.

Diese Trennung ist wichtig, damit spätere Regeländerungen an QTTR/TTR oder Pin/Code nicht die gesamte Importpipeline destabilisieren.
