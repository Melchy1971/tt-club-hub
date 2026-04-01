# Datenschutz- und Audit-Logik

## Datenmodell

- **`member_consents`**
  - Eindeutigkeit über `(member_id, consent_type)`.
  - Erlaubte Consent-Typen: `profile_visible`, `email_hidden`, `phone_hidden`.
  - Zeitkonsistenz:
    - `granted = true` → `granted_at` gesetzt, `revoked_at` leer.
    - `granted = false` → `revoked_at` gesetzt, `granted_at` leer.
- **`consent_audit_log`**
  - Zusätzliche Audit-Metadaten: `action_at`, `actor_ip`, `actor_user_agent`.
  - Aktionsformat mit Quelle:
    - `granted:self`, `revoked:self`
    - `granted:admin`, `revoked:admin`
    - `granted:import`, `revoked:import`
    - `granted:system`, `revoked:system`
- **`deletion_requests`**
  - Erweiterte Workflow-Spalten:
    - `requested_at`, `execution_started_at`, `completed_at`
    - `decision_note`, `legal_hold`
    - `actor_ip`, `actor_user_agent`
  - Status-Constraint: `pending | approved | rejected | cancelled | executing | completed`.

## Service-API

Die Service-API kapselt direkte Tabellenwrites hinter RPC-Calls:

- `toggleConsent(memberId, consentType, granted, source?, context?)`
  - Ruft `rpc_set_member_consent`.
  - Atomar: Consent-Upsert + Audit-Eintrag in einer DB-Transaktion.
- `createDeletionRequest(memberId, reason?, context?)`
  - Ruft `rpc_create_deletion_request`.
  - Liefert die erzeugte Request-ID zurück.
- `updateDeletionStatus(requestId, status, decisionNote?, context?)`
  - Ruft `rpc_transition_deletion_request`.
  - Erzwingt Workflow über DB-Trigger.
- `getSelfPrivacyView()`
  - Liest `member_privacy_self_view` (eigene Daten).
- `getAdminPrivacyView()`
  - Liest `member_privacy_admin_view` (minimierte Daten für Admin/Vorstand).

`context` trägt technische Audit-Metadaten:

- `ip`
- `userAgent`

## Workflow-Regeln

Erlaubte Statusübergänge für Löschanfragen:

1. `pending → approved | rejected | cancelled`
2. `approved → executing | cancelled`
3. `executing → completed`
4. `rejected | cancelled | completed` sind terminal.

Zusätzlich werden Zeitstempel automatisch gesetzt:

- `approved` setzt `reviewed_at`.
- `executing` setzt `execution_started_at`.
- `completed` setzt `completed_at`.

## Sicherheitsreview

### Positive Maßnahmen

- **Datenminimierung**
  - Admin-View liefert nur notwendige Felder; sensible Felder werden anhand von Consent ausgeblendet.
- **Nachvollziehbarkeit**
  - Jeder Consent-Wechsel hat Audit-Spur inkl. Zeitpunkt, IP, User-Agent und Quelle.
- **Integrität**
  - DB-Constraints verhindern ungültige Consent-Zustände und ungültige Deletion-Status.
- **Workflow-Sicherheit**
  - Statusmaschine serverseitig per Trigger, nicht nur im Frontend.
- **Atomarität**
  - Consent + Audit werden gemeinsam in einer RPC-Funktion verarbeitet.

### Restrisiken & Empfehlungen

- **IP-/User-Agent-Vertrauen**
  - Werte kommen vom Client und sind manipulierbar; für hohe Sicherheit über trusted proxy/header serverseitig anreichern.
- **Views ohne explizite RLS**
  - Für produktive Härtung optional separate SECURITY DEFINER-Funktionen mit feineren Rollenchecks einsetzen.
- **Datenaufbewahrung**
  - Retention-Policy für Audit-Logs und abgeschlossene Löschfälle definieren (z. B. gesetzliche Fristen).
- **Legal Hold**
  - `legal_hold` ist modelliert; operative Regeln zur Aktivierung/Entfernung sollten organisatorisch festgelegt werden.
