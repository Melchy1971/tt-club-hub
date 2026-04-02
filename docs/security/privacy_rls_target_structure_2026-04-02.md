# Datenschutz- und RLS-Zielstruktur (Stand: 2026-04-02)

## 1) Datenmodell

> Zielprinzipien: **privacy-by-design**, **deny-by-default**, **Rollenprüfung nur über `user_roles`**, **keine rekursiven Policy-Checks**.

### 1.1 `member_privacy_consents`

```sql
CREATE TABLE IF NOT EXISTS public.member_privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (
    consent_type IN (
      'profile_visibility',
      'email_visibility',
      'phone_visibility',
      'photo_usage',
      'marketing_communication'
    )
  ),
  status text NOT NULL CHECK (status IN ('granted', 'revoked')),
  legal_basis text NOT NULL DEFAULT 'consent',
  source text NOT NULL DEFAULT 'self_service' CHECK (
    source IN ('self_service', 'admin_portal', 'import', 'system')
  ),
  granted_at timestamptz,
  revoked_at timestamptz,
  granted_by uuid REFERENCES auth.users(id),
  revoked_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_privacy_consents_unique UNIQUE (member_id, consent_type),
  CONSTRAINT member_privacy_consents_temporal_ck CHECK (
    (status = 'granted' AND granted_at IS NOT NULL AND revoked_at IS NULL)
    OR
    (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);
```

**Hinweise**

- Eindeutigkeit je Mitglied + Consent-Typ verhindert widersprüchliche Parallelzustände.
- `status` + Zeitkonsistenz-Constraint erzwingen belastbare Historie.
- Technische Änderungsverfolgung läuft über separates Audit-Log (siehe unten), nicht über Tabellen-Overload.

### 1.2 `consent_audit_log` (mit Timestamp, IP, User-Agent)

```sql
CREATE TABLE IF NOT EXISTS public.consent_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consent_id uuid REFERENCES public.member_privacy_consents(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (
    action IN (
      'consent_granted',
      'consent_revoked',
      'consent_migrated',
      'consent_corrected'
    )
  ),
  action_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_role text,
  actor_ip inet,
  actor_user_agent text,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_member_action_at
  ON public.consent_audit_log (member_id, action_at DESC);
```

**Audit-Mindestinhalt pro Event**

- `action_at`
- `actor_user_id`
- `actor_ip`
- `actor_user_agent`
- `details` (z. B. `old_status`, `new_status`, `source`)

### 1.3 `deletion_requests` (Workflow-fähig)

```sql
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'in_review',
      'approved',
      'rejected',
      'cancelled',
      'executing',
      'completed',
      'failed'
    )
  ),
  request_reason text,
  decision_note text,
  legal_hold boolean NOT NULL DEFAULT false,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  execution_started_at timestamptz,
  completed_at timestamptz,
  actor_ip inet,
  actor_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 1.4 RLS-Hilfsfunktionen (rekursionsfrei)

```sql
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public.has_role(p_user_id, 'admin')
      OR public.has_role(p_user_id, 'vorstand')
      OR public.has_role(p_user_id, 'developer');
$$;
```

**Wichtig**

- Policies referenzieren **nur diese Funktionen** bzw. `auth.uid()`, nicht direkte Self-Joins auf RLS-geschützte Tabellen, um rekursive Prüfungen zu vermeiden.

---

## 2) Workflow-Regeln

### 2.1 Consent-Workflow

1. Änderung nur über RPC (`rpc_set_member_privacy_consent`).
2. RPC schreibt atomar:
   - Upsert in `member_privacy_consents`
   - Insert in `consent_audit_log`
3. Bei `granted`:
   - `granted_at = now()`, `revoked_at = NULL`
4. Bei `revoked`:
   - `revoked_at = now()`, `granted_at` bleibt historisch erhalten oder wird nach Policy-Norm genullt.
5. Jede Änderung muss `actor_ip` und `actor_user_agent` in Audit übernehmen (falls vorhanden).

### 2.2 Deletion-Request-Workflow

**Erlaubte Transitionen**

- `pending -> in_review | cancelled`
- `in_review -> approved | rejected | cancelled`
- `approved -> executing | cancelled`
- `executing -> completed | failed`
- `failed -> executing | cancelled`
- `rejected | cancelled | completed` sind terminal

**Regeln**

- Self-Service darf nur für eigene `member_id` anlegen.
- Nur Staff darf `in_review`, `approved`, `rejected`, `executing`, `completed`, `failed` setzen.
- `legal_hold = true` blockiert Übergang zu `executing` und `completed`.
- Statuswechsel nur über `rpc_transition_deletion_request` (DB-seitige Validierung + Audit).

---

## 3) Policy-Matrix (Zielbild)

Legende: ✅ erlaubt, ❌ verboten, ⚠️ nur via RPC/Service-Kanal.

| Tabelle                   | Aktion               | admin |                   vorstand | trainer |         member (self) | member (fremd) | Service Role |
| ------------------------- | -------------------- | ----: | -------------------------: | ------: | --------------------: | -------------: | -----------: |
| `member_privacy_consents` | SELECT               |    ✅ |                         ✅ |      ❌ |                    ✅ |             ❌ |           ✅ |
| `member_privacy_consents` | INSERT               |    ⚠️ |                         ⚠️ |      ❌ |                    ⚠️ |             ❌ |           ✅ |
| `member_privacy_consents` | UPDATE               |    ⚠️ |                         ⚠️ |      ❌ |                    ⚠️ |             ❌ |           ✅ |
| `member_privacy_consents` | DELETE               |    ❌ |                         ❌ |      ❌ |                    ❌ |             ❌ |           ❌ |
| `consent_audit_log`       | SELECT               |    ✅ |                         ✅ |      ❌ |    ✅ (eigene Events) |             ❌ |           ✅ |
| `consent_audit_log`       | INSERT               |    ⚠️ |                         ⚠️ |      ❌ |                    ⚠️ |             ❌ |           ✅ |
| `consent_audit_log`       | UPDATE/DELETE        |    ❌ |                         ❌ |      ❌ |                    ❌ |             ❌ |           ❌ |
| `deletion_requests`       | SELECT               |    ✅ |                         ✅ |      ❌ |  ✅ (eigene Requests) |             ❌ |           ✅ |
| `deletion_requests`       | INSERT               |    ⚠️ |                         ⚠️ |      ❌ |         ⚠️ (nur self) |             ❌ |           ✅ |
| `deletion_requests`       | UPDATE (Workflow)    |    ⚠️ |                         ⚠️ |      ❌ |                    ❌ |             ❌ |           ✅ |
| `deletion_requests`       | DELETE               |    ❌ |                         ❌ |      ❌ |                    ❌ |             ❌ |           ❌ |
| `user_roles`              | SELECT               |    ✅ | ❌ (optional ✅ read-only) |      ❌ | ✅ (nur eigene Rolle) |             ❌ |           ✅ |
| `user_roles`              | INSERT/UPDATE/DELETE |    ✅ |                         ❌ |      ❌ |                    ❌ |             ❌ |           ✅ |

### 3.1 Deny-by-default Umsetzung

- Für jede produktive Tabelle:
  1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
  2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`
  3. **Keine** globale `USING (true)`-Policy für `authenticated`.
  4. Separate SELECT/INSERT/UPDATE/DELETE-Policies mit explizitem `USING`/`WITH CHECK`.

---

## 4) Sicherheitsrisiken (mit Gegenmaßnahmen)

1. **Rollen-Enumeration über offene `user_roles`-Leserechte**
   - Risiko: Angriffsplanung/Privilege-Mapping.
   - Maßnahme: Self-only SELECT, Staff nur minimal.

2. **Spoofing bei Löschanfragen (`member_id` != eigener Benutzer)**
   - Risiko: Unberechtigte Löschprozess-Anstöße.
   - Maßnahme: `WITH CHECK` mit Ownership-Validierung über `members.user_id = auth.uid()`.

3. **Audit-Tampering**
   - Risiko: Nachvollziehbarkeit kompromittiert.
   - Maßnahme: `consent_audit_log` nur INSERT via RPC, kein UPDATE/DELETE.

4. **Policy-Rekursion / Performance-Effekte**
   - Risiko: Query-Fehler, schwer debugbare Zugriffe.
   - Maßnahme: Rollenprüfung ausschließlich über `SECURITY DEFINER`-Funktionen (`has_role`, `is_staff`).

5. **Untrusted Client-Metadaten (IP/User-Agent)**
   - Risiko: manipulierte Telemetrie.
   - Maßnahme: IP serverseitig aus vertrauenswürdigem Proxy/Header ermitteln, Client-Werte nur fallback.

6. **Fehlende Terminal-Workflow-Kontrolle**
   - Risiko: illegale Statussprünge.
   - Maßnahme: Transition-Whitelist in Trigger/Funktion, nicht im Frontend.

---

## 5) Testmatrix je Rolle

### 5.1 Funktionale RLS-Tests

| Testfall                              |               admin |            vorstand | trainer | member_self | member_foreign |
| ------------------------------------- | ------------------: | ------------------: | ------: | ----------: | -------------: |
| Eigenen Consent lesen                 |                  ✅ |                  ✅ |      ❌ |          ✅ |             ❌ |
| Fremden Consent lesen                 |                  ✅ |                  ✅ |      ❌ |          ❌ |             ❌ |
| Consent ändern über RPC (self)        |                  ✅ |                  ✅ |      ❌ |          ✅ |             ❌ |
| Consent ändern direkt per SQL         |                  ❌ |                  ❌ |      ❌ |          ❌ |             ❌ |
| Eigenes Audit sehen                   |                  ✅ |                  ✅ |      ❌ |          ✅ |             ❌ |
| Fremdes Audit sehen                   |                  ✅ |                  ✅ |      ❌ |          ❌ |             ❌ |
| Deletion Request self anlegen         |                  ✅ |                  ✅ |      ❌ |          ✅ |             ❌ |
| Deletion Request fremd anlegen        | ✅ (nur staff flow) | ✅ (nur staff flow) |      ❌ |          ❌ |             ❌ |
| Deletion-Status auf `approved` setzen |                  ✅ |                  ✅ |      ❌ |          ❌ |             ❌ |
| `user_roles` fremd lesen              |                  ✅ |                  ❌ |      ❌ |          ❌ |             ❌ |

### 5.2 Negative Tests (Pflicht)

- Mitglied versucht `UPDATE consent_audit_log` -> muss fehlschlagen.
- Mitglied setzt `deletion_requests.status='approved'` -> muss fehlschlagen.
- Trainer liest `member_privacy_consents` -> muss fehlschlagen.
- Authenticated ohne Rolle liest produktive interne Tabelle mit deny-default -> muss fehlschlagen.

### 5.3 Technische Testumsetzung (Beispiel)

- SQL-basierte Policy-Tests pro Rolle (`SET ROLE` / JWT-Claims in Supabase-Testharness).
- Snapshot-Tests für erlaubte/verbotene Resultsets.
- Transition-Tests für Deletion-Workflow (gültige/ungültige Kanten).

---

## 6) Umsetzungsreihenfolge (empfohlen)

1. Tabellen + Constraints + Indizes erstellen.
2. `SECURITY DEFINER`-Rollenfunktionen erstellen/härten.
3. RLS auf Tabellen aktivieren + FORCE.
4. Deny-by-default Policies ausrollen.
5. RPCs + Trigger für Consent und Deletion-Workflow aktivieren.
6. Rollenbasierte Testmatrix automatisieren und als Release-Gate verwenden.
