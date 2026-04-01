# Trainings-Domain (1:1-Bookings)

## Datenmodell

`training_bookings` repräsentiert **Spieler-zu-Spieler-Trainingsbuchungen** (Requester + Partner) und ist bewusst von Team-Trainingszeiten getrennt.

### Kernattribute
- `requester_id` (UUID, FK -> members.id)
- `partner_id` (UUID, FK -> members.id)
- `booking_date` (DATE)
- `start_time`, `end_time` (TIME)
- `status` (`pending` | `confirmed` | `cancelled`)
- `location`, `note`
- Audit: `created_by`, `created_at`, `updated_at`

### Domain-Regeln auf DB-Ebene
- `requester_id != partner_id`
- `end_time > start_time` (falls `end_time` gesetzt)
- Beide Mitglieder müssen aktiv sein (`members.is_active = true`)
- Keine überlappende Doppelbuchung für ein Mitglied bei aktiven Buchungen (`pending`/`confirmed`)

## Service-API (`trainingService`)

- `list(filters?)`
  - Filterbar nach `member_id`, `requester_id`, `partner_id`, `status`, `booking_date`.
- `getById(id)`
- `create(payload)`
  - Zod-Validierung
  - Mitgliedsvalidierung (existiert + aktiv)
  - Konfliktcheck gegen aktive Buchungen
- `update(id, payload)`
  - Validierung + Status-Transition-Matrix
  - Konfliktcheck für geändertes Zeitfenster
- `updateStatus(id, status)`
- `remove(id)`

## Validierung

Anwendungsseite (`zod`):
- UUID-Validierung für IDs
- ISO-Datum (`YYYY-MM-DD`)
- Zeitformat (`HH:MM`)
- `partner_id !== requester_id`
- `end_time > start_time`
- Normalisierung leerer Strings (`location`, `note`) auf `null`

Datenbankseite (`trigger/constraints`):
- aktive Mitglieder erzwingen
- Zeitfenster prüfen
- Doppelbuchung verhindern

## Edge Cases

- **Stornierte Buchungen blockieren keine neuen Slots** (`status = cancelled` wird ignoriert).
- **Statuswechsel**: `cancelled` ist terminal (kein Reopen).
- **Überlappung statt nur exakter Zeitgleichheit**: Konflikte werden für jede Zeitüberschneidung erkannt.
- **Rollenwechsel Requester/Partner**: Konfliktprüfung berücksichtigt beide Rollen symmetrisch.
- **Trennung Team-Zeiten**: Team-Trainingszeiten liegen weiterhin außerhalb von `training_bookings`.
