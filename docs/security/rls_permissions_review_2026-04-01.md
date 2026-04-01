# Security Review: RLS & Berechtigungen (Stand: 2026-04-01)

## Scope
Review der vorhandenen Supabase/PostgreSQL-Migrationen mit Fokus auf:
- Policy-Lücken
- Rekursionsvermeidung in RLS-Ausdrücken
- Verhinderung von Privilegienausweitung
- Trennung öffentlich vs. intern/sensibel
- Rollenspezifische Testfälle

## 1) Review-Liste (Befunde)

### A. Policy-Lücken / zu breite Leserechte
1. **`members` ist für alle authentifizierten Nutzer vollständig lesbar** (`USING (true)`).
   - Risiko: unnötige Offenlegung von PII (Adresse, Telefon, E-Mail, Geburtsdatum).
2. **`user_roles` ist für alle authentifizierten Nutzer lesbar** (`USING (true)`).
   - Risiko: interne Rollen-/Berechtigungsstruktur ist für alle sichtbar.
3. **`member_consents`, `consent_audit_log`, `deletion_requests` hatten initial offene SELECT-Policies** (`USING (true)`) und wurden später zwar eingeschränkt, aber ohne zusätzliche Schutzmechanismen gegen Metadaten-Leakage.
4. **Mehrere UPDATE-Policies nutzen nur `USING`, aber kein `WITH CHECK`**.
   - Risiko: Zeile ist updatebar, aber neue Werte werden nicht explizit gegen Rollen-/Ownership-Regeln validiert.

### B. Rekursion / RLS-Expressions
5. `has_role()` und `is_admin_or_board()` sind `SECURITY DEFINER` und lesen `user_roles`.
   - Positiv: verhindert typische Selbstrekursion in Policies auf `user_roles`.
   - Restrisiko: ohne Härtung von Funktionseigentümer/-rechten kann es ungewollte Wirkung geben.
6. Mehrere Policies verwenden Subqueries wie `member_id IN (SELECT id FROM members WHERE user_id = auth.uid())`.
   - Technisch ok, aber hoher Wiederholungsgrad und potenziell schwer zu auditieren.

### C. Privilegienausweitung
7. **Selbst-Update auf `members` (`OR user_id = auth.uid()`) ohne Spalteneinschränkung**.
   - Risiko: Nutzer könnten sensible Felder (z. B. Ratings, Statusfelder, Meta-Felder) verändern, wenn keine Trigger/Column-Guards existieren.
8. **INSERT auf `deletion_requests` erlaubt `requested_by = auth.uid()`**, aber ohne harten Guard auf `member_id`.
   - Risiko: Nutzer könnten Löschanfragen für fremde `member_id` erzeugen, sofern bekannt.
9. `user_roles`-INSERT/DELETE ist Admin-only, aber es fehlt eine explizite Schutzregel gegen Zuweisung technischer Rollen (z. B. `developer`) durch nicht-systemische Prozesse.

### D. Öffentliche vs interne Daten
10. Aktuell sind Domain-Tabellen überwiegend auf „authenticated = lesbar“ ausgelegt.
    - Empfehlung: in **public_profile** (öffentlich intern) vs. **private_profile** (sensibel) aufteilen und strikt trennen.
11. `member_private` wurde als Struktur angelegt, aber ohne aktivierte RLS-/Policies.
    - Risiko: wenn später aktiviert/benutzt, könnten Defaults fehlen oder inkonsistent umgesetzt werden.

---

## 2) Empfohlene SQL-Policies (Härtungsvorschlag)

> Ziel: minimal notwendige Rechte (least privilege), klare Trennung sensibler Daten, keine policy-seitige Rekursion.

### 2.1 Hilfsfunktionen (zentral, SECURITY DEFINER, feste search_path)
```sql
create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role = 'admin'
  )
$$;

create or replace function public.is_board_or_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _uid and role in ('admin', 'vorstand')
  )
$$;

create or replace function public.is_self_member(_member_id uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.id = _member_id and m.user_id = _uid
  )
$$;
```

### 2.2 `user_roles` restriktiv machen
```sql
drop policy if exists "User_roles lesbar für authentifizierte Nutzer" on public.user_roles;

create policy user_roles_select_self_or_admin
on public.user_roles
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

-- optional: nur admin darf Rollen außer 'developer' vergeben
-- (technische Rolle ausschließlich über service role / migration)
```

### 2.3 `members` in Public/Private trennen
```sql
-- 1) Öffentliche Felder über View bereitstellen
create or replace view public.member_public_profiles
with (security_invoker = true)
as
select
  id,
  first_name,
  last_name,
  age_group,
  is_active
from public.members;

-- 2) members-select einschränken
drop policy if exists "Members sind für alle authentifizierten Nutzer lesbar" on public.members;
create policy members_select_self_or_staff
on public.members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_board_or_admin(auth.uid())
  or public.has_role(auth.uid(), 'trainer')
);

-- 3) self-update härten (USING + WITH CHECK)
drop policy if exists "Members aktualisierbar" on public.members;
create policy members_update_self_or_staff
on public.members
for update to authenticated
using (
  user_id = auth.uid()
  or public.is_board_or_admin(auth.uid())
  or public.has_role(auth.uid(), 'trainer')
)
with check (
  user_id = auth.uid()
  or public.is_board_or_admin(auth.uid())
  or public.has_role(auth.uid(), 'trainer')
);
```

### 2.4 `member_private` aktiv nutzen (PII-Isolation)
```sql
alter table public.member_private enable row level security;

create policy member_private_select_self_or_board
on public.member_private
for select to authenticated
using (
  public.is_self_member(member_id, auth.uid())
  or public.is_board_or_admin(auth.uid())
);

create policy member_private_update_self_or_board
on public.member_private
for update to authenticated
using (
  public.is_self_member(member_id, auth.uid())
  or public.is_board_or_admin(auth.uid())
)
with check (
  public.is_self_member(member_id, auth.uid())
  or public.is_board_or_admin(auth.uid())
);
```

### 2.5 `deletion_requests` Missbrauch verhindern
```sql
drop policy if exists "deletion_requests_insert" on public.deletion_requests;
create policy deletion_requests_insert_self_or_board
on public.deletion_requests
for insert to authenticated
with check (
  public.is_board_or_admin(auth.uid())
  or (
    requested_by = auth.uid()
    and public.is_self_member(member_id, auth.uid())
  )
);
```

### 2.6 Policy-Bypass minimieren
```sql
-- optional, aber empfohlen bei sensiblen Tabellen
alter table public.members force row level security;
alter table public.member_private force row level security;
alter table public.user_roles force row level security;
```

---

## 3) Rollentestmatrix (RLS-Testszenarien)

Legende: ✅ erlaubt, ❌ verboten.

| Szenario | admin | vorstand | trainer | spieler/mitglied (self) | spieler/mitglied (fremd) |
|---|---:|---:|---:|---:|---:|
| Rollen anderer Nutzer lesen (`user_roles`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Eigene Rolle lesen (`user_roles`) | ✅ | ✅ | ✅ | ✅ | n/a |
| `members` lesen (voll) | ✅ | ✅ | ✅ | ✅ (nur eigene Zeile) | ❌ |
| `member_public_profiles` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `member_private` lesen | ✅ | ✅ | ❌ (optional) | ✅ (eigene) | ❌ |
| `member_private` updaten | ✅ | ✅ | ❌ (optional) | ✅ (eigene) | ❌ |
| `members` updaten (allgemein) | ✅ | ✅ | ✅ (fachlich begrenzt) | ✅ (eigene + erlaubte Spalten) | ❌ |
| `deletion_requests` für eigenes Mitglied erstellen | ✅ | ✅ | ✅ (optional je Prozess) | ✅ | ❌ |
| `deletion_requests` für fremdes Mitglied erstellen | ✅ | ✅ | ❌ | ❌ | ❌ |
| Rollen vergeben/entziehen | ✅ | ❌ | ❌ | ❌ | ❌ |

### Konkrete SQL-Testfälle (Beispiele)
1. **Self-read**: als Spieler A `select * from members where user_id = auth.uid();` → genau 1 Datensatz.
2. **Cross-read block**: als Spieler A `select * from members where id = <member_B>;` → 0 Datensätze.
3. **Self-private read**: als Spieler A `select * from member_private where member_id = <member_A>;` → erlaubt.
4. **Cross-private read block**: als Spieler A `select * from member_private where member_id = <member_B>;` → 0 Datensätze.
5. **Deletion request spoofing block**: als Spieler A insert mit `member_id=<member_B>, requested_by=auth.uid()` → Fehler (WITH CHECK verletzt).
6. **Role visibility block**: als Trainer `select * from user_roles;` → nur eigene Rollen.
7. **Board staff access**: als Vorstand read/update auf fremdes `member_private` → erlaubt.
8. **Admin role management**: als Admin INSERT/DELETE auf `user_roles` → erlaubt; als Vorstand → verboten.

---

## 4) Priorisierte Umsetzung
1. **Sofort**: `user_roles` und `members` SELECT härten.
2. **Sofort**: `deletion_requests_insert` mit Self-Member-Guard absichern.
3. **Kurzfristig**: `member_private` produktiv aktivieren + Datenmigration aus `members`.
4. **Kurzfristig**: alle UPDATE-Policies auf `USING` + `WITH CHECK` standardisieren.
5. **Mittelfristig**: ergänzende DB-Tests (pgTAP oder Supabase SQL tests) pro Rolle in CI.
