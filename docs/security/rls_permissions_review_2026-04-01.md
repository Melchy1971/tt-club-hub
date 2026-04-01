# Vollständiges RLS- & Security-Review (Stand: 2026-04-01)

## Scope & Methode
Analysiert wurden die produktiven Supabase-Migrationen inkl. späterer Härtungen, insbesondere:
- Basisschema und Kern-RLS-Policies (`20260326161044_...`).
- Domänenmigrationen (Board, Training, Substitutes, Season Cycle, Privacy).
- Nachträgliche Policy-Anpassungen (`20260401083431_...`, `20260401101500_...`, `20260401160000_...`).

Zielbild dieses Reviews:
1. **Policies auf allen produktiven Tabellen**.
2. **Deny-by-default** statt breit erlaubender Lesepolicies.
3. **Rollenprüfung ausschließlich über `user_roles`** (direkt oder über `SECURITY DEFINER`-Hilfsfunktionen).
4. **Vermeidung rekursiver Policy-Checks**.
5. **Strikte Trennung öffentlich vs. intern/sensibel**.

---

## 1) Executive Summary

**Positiv**
- RLS ist auf den produktiven Tabellen durchgängig aktiviert.
- Rollenprüfung läuft zentral über `user_roles` via `has_role()` und `is_admin_or_board()` (beide `SECURITY DEFINER`), wodurch rekursive RLS-Auswertung auf `user_roles` praktisch vermieden wird.
- Privacy-Domäne wurde mit zusätzlicher Auditierung, Workflows und RPCs deutlich gehärtet.

**Kritische Restlücken (priorisiert)**
1. **Kein konsequentes deny-by-default bei SELECT**: Viele Tabellen sind weiterhin für alle `authenticated` lesbar (`USING (true)`).
2. **Öffentlich/interne Daten noch nicht strikt getrennt**: `member_profile_view` enthält weiterhin sensible Kontakt-/Adressdaten für alle Auth-User.
3. **Teilweise fehlende `WITH CHECK` bei UPDATE**: In mehreren Domänen nur `USING`, wodurch Zielzustände nicht explizit gegengeprüft werden.
4. **`user_roles` weiterhin breit lesbar**: Rollenmapping aller Nutzer ist für jeden Auth-User sichtbar.
5. **Self-Service Delete-Request kann fremde `member_id` referenzieren** (Spoofing-Risiko), solange nur `requested_by = auth.uid()` geprüft wird.

---

## 2) Policy-Matrix (produktive Tabellen)

Legende:
- **Status**: ✅ gut, ⚠️ mittel, ❌ kritisch.
- **Deny-default**: erfüllt, wenn kein globales `USING (true)` für breite Rollen vorliegt.

| Tabelle | Aktuelle SELECT-Logik (vereinfacht) | Write-Logik (vereinfacht) | Deny-default | Haupt-Risiko | Status |
|---|---|---|---|---|---|
| `roles` | `authenticated` darf lesen | mutierend nicht offen | ⚠️ | Rollenmodell für alle sichtbar | ⚠️ |
| `user_roles` | `authenticated` darf lesen (`USING true`) | Insert/Delete Admin | ❌ | Rollen-Transparenz/Reconnaissance | ❌ |
| `club_settings` | nur Admin/Vorstand/Developer | Write Admin | ✅ | gering | ✅ |
| `members` | `authenticated` darf lesen (`USING true`) | Update inkl. self (`user_id = auth.uid()`) | ❌ | PII-Leak + breite Self-Update-Fläche | ❌ |
| `member_consents` | self oder Admin/Vorstand | self oder Admin/Vorstand | ✅ | mittel (Subquery auf members) | ⚠️ |
| `consent_audit_log` | self oder Admin/Vorstand | Insert self/Admin/Vorstand | ✅ | Audit-Manipulation ohne restriktive RPC-only Strategie | ⚠️ |
| `deletion_requests` | self (`requested_by`) oder Admin/Vorstand | Insert self/Admin/Vorstand, Update meist staff | ⚠️ | fremde `member_id` bei self-insert möglich | ❌ |
| `roles_module_permissions` | `authenticated` lesen | mutierend Admin | ⚠️ | interne Rechte-Matrix sichtbar | ⚠️ |
| `seasons` | `authenticated` lesen | staff write/delete | ⚠️ | gering bis mittel | ⚠️ |
| `season_cycles` | `authenticated` lesen | staff write/delete | ⚠️ | gering bis mittel | ⚠️ |
| `season_phases` | `authenticated` lesen | staff write/delete | ⚠️ | gering bis mittel | ⚠️ |
| `venues` | `authenticated` lesen | staff write/delete | ⚠️ | gering | ⚠️ |
| `teams` | `authenticated` lesen | staff write/delete | ⚠️ | gering | ⚠️ |
| `team_members` | `authenticated` lesen | staff write/delete | ⚠️ | indirekte Teamstruktur-Exponierung | ⚠️ |
| `schedule_matches` | `authenticated` lesen | staff write/delete | ⚠️ | gering | ⚠️ |
| `match_availability` | `authenticated` lesen | staff/self abhängig von Policy | ⚠️ | Verfügbarkeitsdaten zu breit lesbar | ⚠️ |
| `match_lineup` | `authenticated` lesen | staff write | ⚠️ | Teaminterna für alle sichtbar | ⚠️ |
| `training_bookings` | breite Leserechte (inkl. Spieler) | staff + beteiligte Nutzer | ⚠️ | Zeit-/Anwesenheitsmuster sichtbar | ⚠️ |
| `substitute_requests` | breite Leserechte für staff/teils alle | staff write + owner-Pfade | ⚠️ | Abwesenheits-/Gesundheitsbezug | ⚠️ |
| `news` | `authenticated` lesen | staff write | ⚠️ | ok, falls rein intern | ⚠️ |
| `documents` | `authenticated` lesen | staff write/delete | ❌ | potenziell sensible Dateien intern weit offen | ❌ |
| `meetings` | `authenticated` lesen | Admin/Vorstand write/delete | ❌ | Vorstands-/Gremiendaten zu offen | ❌ |
| `meeting_documents` | read typ. staff (besser als meetings) | staff write/delete | ⚠️ | abhängig von Meetings-Linkage | ⚠️ |
| `communication_lists` | `authenticated` lesen | staff write/delete | ❌ | interne Verteiler sichtbar | ❌ |
| `communication_list_members` | `authenticated` lesen | staff write/delete | ❌ | Mitgliedschaft in Verteilern offen | ❌ |

### Einordnung zur Zielerreichung
- **Policies auf allen produktiven Tabellen:** formal weitgehend vorhanden.
- **Deny-by-default:** aktuell **nicht erreicht**.
- **Rollenprüfung nur über `user_roles`:** **weitgehend erreicht** (`has_role`/`is_admin_or_board`), aber direkte Freigaben (`USING true`) unterlaufen Least Privilege.
- **Rekursive Policy-Checks vermeiden:** **erreicht** durch `SECURITY DEFINER`-Funktionen.
- **Public vs internal strikt trennen:** **nicht erreicht** (Profile/Kommunikation/Board-ähnliche Daten).

---

## 3) SQL-Empfehlungen (konkret, priorisiert)

## P0 – Sofortmaßnahmen

### 3.1 `user_roles` auf self/staff begrenzen
```sql
DROP POLICY IF EXISTS "User_roles lesbar für authentifizierte Nutzer" ON public.user_roles;

CREATE POLICY user_roles_select_self_or_admin
ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'developer')
);
```

### 3.2 `members`-SELECT auf Need-to-know umstellen
```sql
DROP POLICY IF EXISTS "Members sind für alle authentifizierten Nutzer lesbar" ON public.members;

CREATE POLICY members_select_self_or_staff
ON public.members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vorstand')
  OR public.has_role(auth.uid(), 'trainer')
);
```

### 3.3 Delete-Request-Spoofing blockieren
```sql
DROP POLICY IF EXISTS "deletion_requests_insert" ON public.deletion_requests;

CREATE POLICY deletion_requests_insert_self_guarded
ON public.deletion_requests
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_board(auth.uid())
  OR (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = member_id
        AND m.user_id = auth.uid()
    )
  )
);
```

## P1 – Strikte Datenklassentrennung

### 3.4 Öffentliche vs interne Profilsicht trennen
```sql
CREATE OR REPLACE VIEW public.member_public_profile
WITH (security_invoker = true)
AS
SELECT id, first_name, last_name, is_active
FROM public.members;

GRANT SELECT ON public.member_public_profile TO anon, authenticated;

-- member_profile_view auf interne Rollen begrenzen oder ersetzen
REVOKE SELECT ON public.member_profile_view FROM authenticated;
GRANT SELECT ON public.member_profile_view TO authenticated; -- nur falls zusätzlich über RLS/View-Security eingegrenzt
```

> Praktisch sollte `member_profile_view` in **public_profile_view** (ohne Kontakt/Adresse) und **internal_profile_view** (nur staff) aufgespalten werden.

### 3.5 Interne Domänen tabellenweise dichtziehen
Empfohlen für `meetings`, `documents`, `communication_lists`, `communication_list_members`:
```sql
DROP POLICY IF EXISTS meetings_select ON public.meetings;
CREATE POLICY meetings_select_staff
ON public.meetings
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vorstand')
);
```
Analog für die übrigen internen Tabellen.

## P1 – Policy-Konsistenz

### 3.6 UPDATE-Policies immer mit `USING` + `WITH CHECK`
```sql
DROP POLICY IF EXISTS news_update ON public.news;
CREATE POLICY news_update
ON public.news
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vorstand')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'vorstand')
);
```

### 3.7 Sensitive Tabellen mit `FORCE ROW LEVEL SECURITY`
```sql
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consent_audit_log FORCE ROW LEVEL SECURITY;
```

## P2 – Governance & Härtung

### 3.8 Rollenvergabe auf erlaubte Rollen einschränken
```sql
CREATE OR REPLACE FUNCTION public.prevent_privileged_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'developer'::public.app_role
     AND NOT public.has_role(auth.uid(), 'developer') THEN
    RAISE EXCEPTION 'developer role may only be assigned by developers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_role_assignment ON public.user_roles;
CREATE TRIGGER trg_prevent_privileged_role_assignment
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_role_assignment();
```

---

## 4) Rollentestmatrix (Soll-Zustand)

Legende: ✅ erlaubt, ❌ verboten.

| Testfall | admin | vorstand | trainer | mitglied (self) | mitglied (fremd) |
|---|---:|---:|---:|---:|---:|
| `user_roles` fremde Rollen lesen | ✅ | ❌ | ❌ | ❌ | ❌ |
| `user_roles` eigene Rollen lesen | ✅ | ✅ | ✅ | ✅ | n/a |
| `members` eigene Zeile lesen | ✅ | ✅ | ✅ | ✅ | ❌ |
| `members` fremde sensible Daten lesen | ✅ | ✅ | rollenabhängig | ❌ | ❌ |
| `member_public_profile` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `member_consents` eigene lesen/updaten | ✅ | ✅ | ❌ | ✅ | ❌ |
| `consent_audit_log` eigene lesen | ✅ | ✅ | ❌ | ✅ | ❌ |
| `deletion_requests` eigene erstellen | ✅ | ✅ | prozessabhängig | ✅ | ❌ |
| `deletion_requests` für fremdes Mitglied erstellen | ✅ | ✅ | ❌ | ❌ | ❌ |
| `meetings` lesen | ✅ | ✅ | ❌ | ❌ | ❌ |
| `communication_lists` lesen | ✅ | ✅ | optional staff | ❌ | ❌ |
| Rollen vergeben/entziehen (`user_roles`) | ✅ | ❌ | ❌ | ❌ | ❌ |

### Empfohlene SQL-Tests (Beispiele)
1. Self-read/foreign-read für `members`.
2. Self/fremd Insert auf `deletion_requests`.
3. Sichtbarkeit `user_roles` self vs foreign.
4. Read-Barrieren auf `meetings` und `communication_lists` für normale Mitglieder.
5. Update mit unerlaubtem Zielwert gegen `WITH CHECK` verifizieren.

---

## 5) Risikoanalyse

## A) Vertraulichkeit (hoch)
- Offene SELECT-Policies auf Profil-/Kommunikations-/Board-nahen Tabellen ermöglichen **horizontale Dateneinsicht** durch jeden Auth-User.
- Besonders kritisch: `members`, `documents`, `meetings`, `communication_list_members`.

## B) Integrität (mittel bis hoch)
- Fehlende `WITH CHECK` bei UPDATE in mehreren Tabellen kann ungewollte Zustandsübergänge erleichtern.
- Delete-Request-Spoofing erlaubt potenziell Prozessmissbrauch (fremde Löschanfragen).

## C) Rechteeskalation (mittel)
- Obwohl Rollenprüfung sauber über `user_roles` funktioniert, kann zu breite Lesbarkeit von Rollendaten Angriffsplanung begünstigen.
- Systemrollen sind auf `roles`-Ebene gegen Mutation geschützt; Zuweisungsregeln in `user_roles` sollten dennoch enger werden.

## D) Compliance/DSGVO (hoch)
- Fehlende harte Trennung zwischen öffentlichen und internen personenbezogenen Daten gefährdet Datenminimierung und Need-to-know-Prinzip.

### Risikobewertung gesamt
- **Aktuelles Risiko:** **Mittel-Hoch**.
- **Nach Umsetzung P0/P1:** **Niedrig-Mittel**.

---

## 6) Umsetzungs-Roadmap

1. **Sprint 1 (P0):** `user_roles`, `members`, `deletion_requests` härten + Regressionstests.
2. **Sprint 2 (P1):** Profil-Views sauber aufteilen, interne Domänen auf staff-only SELECT umstellen.
3. **Sprint 3 (P1/P2):** `WITH CHECK`-Standardisierung + `FORCE RLS` auf sensitiven Tabellen.
4. **Sprint 4 (P2):** CI-RLS-Testmatrix (SQL-basiert) als verpflichtendes Gate.

Damit ist das Zielbild (deny-by-default, Rollenprüfung via `user_roles`, rekursionsfreie Policies, strikte Datentrennung) robust erreichbar.
