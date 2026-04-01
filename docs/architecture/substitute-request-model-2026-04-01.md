# Ersatzstellungslogik – Modell (Stand: 2026-04-01)

## Ziele

- `substitute_requests` mit klar definiertem Status-Workflow modellieren.
- Konflikte früh verhindern:
  - doppelte Anfrage,
  - bereits bestätigte Ersatzstellung,
  - falsche `season_phase`.
- Berechtigungen sauber trennen für **Trainer**, **Vorstand**, **Admin**, **Spieler**.
- „Offene“ und „eingehende“ Anfragen effizient abfragbar machen.

---

## 1) Datenmodell

### 1.1 Tabelle `substitute_requests`

```sql
id                  uuid pk default gen_random_uuid()
match_id             uuid not null references schedule_matches(id)
requesting_team_id   uuid not null references teams(id)
substitute_member_id uuid not null references members(id)

status               substitute_request_status not null default 'pending'

requested_by         uuid null references auth.users(id)
resolved_by          uuid null references auth.users(id)
resolved_at          timestamptz null

note                 text null check (char_length(note) <= 500)
resolution_note      text null check (char_length(resolution_note) <= 500)

created_at           timestamptz not null default now()
updated_at           timestamptz not null default now()
```

### 1.2 Status-Enum

```text
pending | accepted | declined | cancelled
```

### 1.3 Integritätsregeln (DB-seitig)

1. **Keine Doppelanfrage im aktiven Zustand**
   - Unique partial index auf `(match_id, substitute_member_id)` für `status='pending'`.
2. **Keine zweite Bestätigung für dasselbe Match/Spieler-Paar**
   - Unique partial index auf `(match_id, substitute_member_id)` für `status='accepted'`.
3. **Saison-/Phasenkonsistenz**
   - `requesting_team_id` muss zu derselben Saison/Season-Cycle gehören wie `match_id`.
   - Zusätzlich: `teams.season_phase_id` muss zu `schedule_matches.season_phase_id` passen.
4. **Keine Ersatzanfrage an Stammspieler des anfragenden Teams**
   - Trigger-Check gegen `team_members`.
5. **Auditierbarkeit**
   - `requested_by`, `resolved_by`, `resolved_at`, `updated_at` durch Trigger/Service sauber pflegen.

### 1.4 Performance-Indizes

- `idx_substitute_match_status(match_id, status)`
- `idx_substitute_member(substitute_member_id)`
- `idx_substitute_team_status(requesting_team_id, status)`
- `idx_substitute_pending(status, created_at desc) where status='pending'`

Optional zusätzlich:

- `idx_substitute_member_status(substitute_member_id, status, created_at desc)` für Spieler-Inbox.
- Materialisierte Sicht oder View für Dashboard-Join-Daten (`match_date`, Teamname, Gegner, Phase).

---

## 2) Service-API

> Ziel: kleine, klar getrennte API mit konfliktarmen Operationen.

### 2.1 Domain-Typen

```ts
type SubstituteRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

type SubstituteRequest = {
  id: string;
  match_id: string;
  requesting_team_id: string;
  substitute_member_id: string;
  status: SubstituteRequestStatus;
  requested_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  note: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};
```

### 2.2 Query-Methoden

1. `listOpenByTeam(teamIds: string[], limit?: number)`
   - liefert offene Team-Anfragen (`status='pending'`).
2. `listIncomingForMember(memberId: string, limit?: number)`
   - liefert eingehende Anfragen eines Spielers (`status='pending'`).
3. `listHistoryForMember(memberId: string, from?: string, to?: string)`
   - vergangene Entscheidungen (`accepted|declined|cancelled`).
4. `getById(id: string)`
   - Detail inkl. Berechtigungsprüfung.

### 2.3 Command-Methoden

1. `createRequest(input)`
   - nur erlaubte Rollen,
   - Preflight (optional) + DB-Insert (source of truth in DB-Constraints).
2. `acceptRequest(id, actorUserId, resolutionNote?)`
3. `declineRequest(id, actorUserId, resolutionNote?)`
4. `cancelRequest(id, actorUserId, resolutionNote?)`

Alle Command-Methoden müssen:

- Status-Transition prüfen,
- `resolved_by` setzen,
- `resolved_at` auf Übergang von `pending` in terminalen Zustand setzen,
- idempotent auf bereits terminale Requests reagieren (`409` oder `200 no-op`, je nach API-Konvention).

### 2.4 API-/Fehlercode-Konvention

- `400` invalid payload / ungültiger Übergang
- `403` fehlende Berechtigung
- `404` Anfrage nicht gefunden / nicht sichtbar
- `409` Konflikt (Doppelanfrage, bereits akzeptiert, season_phase mismatch)
- `422` Business Rule verletzt (z. B. eigener Stammspieler)

---

## 3) Statusregeln

### 3.1 Erlaubte Übergänge

- `pending -> accepted`
- `pending -> declined`
- `pending -> cancelled`
- `accepted -> cancelled` (nur bis Matchstart empfohlen, danach Warnung/Block je Produktentscheidung)
- alle anderen Übergänge **verboten**

### 3.2 Rollenmatrix

- **Spieler**
  - lesen: eigene eingehende/ausgehende Requests (oder global read je nach RLS-Design)
  - schreiben: Anfrage erstellen (optional, wenn fachlich erlaubt)
  - entscheiden: **nur eigene** eingehende Anfrage annehmen/ablehnen
  - stornieren: eigene erstellte Anfrage (wenn `requested_by = auth.uid()`)
- **Trainer**
  - lesen: Team-bezogene Requests
  - erstellen: für eigenes Team
  - stornieren: Team-Requests
  - entscheiden: je nach fachlicher Regel optional (oft ja)
- **Vorstand**
  - lesen/schreiben/entscheiden global
- **Admin**
  - lesen/schreiben/entscheiden global

> Empfehlung: „Entscheiden im Namen des Spielers“ nur für Trainer+ und nur mit Audit-Note erlauben.

### 3.3 Konfliktregeln

1. **Doppelte Anfrage**
   - gleiches `match_id + substitute_member_id` bei `pending` -> blockieren.
2. **Bereits bestätigt**
   - gleiches `match_id + substitute_member_id` bei `accepted` -> blockieren.
3. **Falsche season_phase**
   - Team/Match-Phase inkonsistent -> blockieren.
4. **Selbst-Anfrage/inkonsistente Identität**
   - optional blockieren, falls `requested_by` derselbe Spieler ist und Fachregel das verbietet.

---

## 4) Edge Cases

1. **Race Condition bei zwei gleichzeitigen Inserts**
   - Lösung: Unique-Indizes + transaktionales Insert; Service mappt DB-Error auf `409`.

2. **Race Condition Accept vs. Cancel**
   - Lösung: `UPDATE ... WHERE id=? AND status='pending'` mit row count check.

3. **Request wird beantwortet, während Match bereits gestartet/abgeschlossen**
   - Lösung: DB-Trigger oder Service-Check gegen `match_date`; ab Stichtag nur noch `cancelled` durch Admin/Vorstand.

4. **Spieler verlässt den Verein / wird deaktiviert**
   - Offene Requests entweder hart auf `cancelled` setzen oder per nightly job auflösen.

5. **Teamwechsel zwischen Anfrage und Entscheidung**
   - bei Entscheidung erneut Team-/Season-Consistency prüfen.

6. **Mehrere Rollen pro User (z. B. Spieler + Trainer)**
   - effektive Berechtigung = Union der Rollen, aber Actions im Audit mit „acting_role“ loggen.

7. **RLS-Filter vs. Dashboard-Zahlen**
   - Counts immer aus demselben gefilterten Query-Set ableiten, sonst inkonsistente Badge-Zahlen.

8. **Idempotenz bei wiederholtem Klick**
   - zweite identische Entscheidung liefert keine harte Fehlermeldung im UI, sondern klaren Hinweis „bereits entschieden“.

---

## 5) Empfohlene Implementierungsreihenfolge

1. DB-Regeln finalisieren (Constraints, Trigger, Indexe, RLS).
2. Service-API entlang der obigen Command-/Query-Trennung aufbauen.
3. UI auf offene/eingehende Queries umstellen (eigene Query Keys).
4. Fehler-Mapping (`23505`, Trigger-Exceptions) auf fachliche Meldungen standardisieren.
5. Optional: RPC/View für Dashboard-Performance hinzufügen.
