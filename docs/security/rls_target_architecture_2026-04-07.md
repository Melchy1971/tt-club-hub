# Vollständiges RLS-Zieldesign – 2026-04-07

## Zielbild

Dieses Dokument definiert das Ziel-RLS-Design für alle produktiven Kern- und Fachtabellen der Anwendung.

Leitprinzipien:

- **deny-by-default**
- **Zugriff nur über `user_roles` und modulare Berechtigungen**
- **Self-Service nur für eigene Daten**
- **Admin/Vorstand-Sonderrechte minimal und zweckgebunden**
- **keine rekursiven oder zirkulären Policy-Abhängigkeiten**

Dieses Zielbild ersetzt breit offene `USING (true)`-Policies durch explizite, tabellen- und aktionsspezifische Regeln.

---

## 1. Geltungsbereich und Tabellenmapping

Die geforderten Tabellen werden auf die realen Produktionsobjekte wie folgt abgebildet:

- `members` -> `public.members`
- `user_roles` -> `public.user_roles`
- `roles` -> `public.roles`
- `season_cycles` -> `public.season_cycles`
- `season_phases` -> `public.season_phases`
- `teams` -> `public.teams`
- `team_assignments` -> `public.team_members`
- `schedule_matches` -> `public.schedule_matches`
- `substitute_requests` -> `public.substitute_requests`
- `training_bookings` -> `public.training_bookings`
- `news` -> `public.news`
- `documents` -> `public.documents`
- `board_meetings` -> `public.meetings`
- `deletion_requests` -> `public.deletion_requests`
- `privacy_consents` -> Zielbild `public.member_privacy_consents`, Übergang aktuell `public.member_consents`

Hinweis:

- Für die Teamzuordnungen verwendet die aktuelle Anwendung `team_members` statt `team_assignments`.
- Für Datenschutz-Consents existiert aktuell `member_consents`; das fachliche Zielmodell heißt `member_privacy_consents`.

---

## 2. SQL-Strategie

## 2.1 Grundmuster für jede produktive Tabelle

Für jede produktive Tabelle gilt:

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<table_name> FORCE ROW LEVEL SECURITY;
```

Zusätzlich gelten diese Regeln:

- keine globale `FOR SELECT USING (true)`-Policy für `authenticated`
- getrennte Policies für `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- `UPDATE` immer mit `USING` **und** `WITH CHECK`
- schreibende Policies nur auf Zieltabellen, nie auf Views

## 2.2 Hilfsfunktionen statt Policy-Subqueries

Rollenprüfung und modulare Berechtigungen laufen ausschließlich über rekursionsfreie `SECURITY DEFINER`-Hilfsfunktionen.

Pflichtfunktionen:

```sql
public.has_role(p_user_id uuid, p_role text)
public.is_admin(p_user_id uuid)
public.is_admin_or_board(p_user_id uuid)
public.is_staff(p_user_id uuid)
public.has_permission(p_user_id uuid, p_permission text)
public.is_member_self(p_member_id uuid, p_user_id uuid)
```

Optional, aber empfohlen:

```sql
public.has_module_read(p_user_id uuid, p_module text)
public.has_module_write(p_user_id uuid, p_module text)
public.has_module_delete(p_user_id uuid, p_module text)
```

## 2.3 Modulare Berechtigungen

`user_roles` ist der einzige Rollenanker. Modulare Berechtigungen werden logisch aus Rollen und ggf. Rollen-/Rechte-Matrix abgeleitet, aber **nicht** durch freie Tabellenleserechte auf `user_roles` oder `roles_module_permissions` ersetzt.

Regel:

- Policies verwenden Funktionen wie `has_permission(auth.uid(), 'member:read')`
- diese Funktionen kapseln die Auswertung der Rollen- und Rechtebeziehungen

## 2.4 Self-Service-Pattern

Self-Service-Zugriffe werden nur über Ownership-Prüfungen erlaubt:

```sql
EXISTS (
  SELECT 1
  FROM public.members m
  WHERE m.id = <member_id>
    AND m.user_id = auth.uid()
)
```

Diese Prüfung sollte nach Möglichkeit ebenfalls in einer Funktion gekapselt werden, damit Policies nicht untereinander referenzieren.

## 2.5 View-Strategie

Für breit lesbare oder teilöffentliche Daten werden Views statt direkter Tabellenfreigaben verwendet:

- `member_public_profile`
- `club_public_info`
- später optional weitere `*_public_view`-Modelle

Regel:

- wenn unterschiedliche Rollen stark unterschiedliche Feldmengen sehen dürfen, wird das über getrennte Views oder Projection-Services modelliert, nicht über offene Tabellen-SELECTs.

---

## 3. Policy-Matrix

Legende:

- ✅ direkt erlaubt
- ⚠️ nur über Service/RPC bzw. zweckgebundene Staff-Policy
- ❌ verboten

## 3.1 Rollenbasis

Verwendete Rollensichten:

- `admin`
- `vorstand`
- `trainer`
- `mitglied_self`
- `mitglied_foreign`
- `service_role`

## 3.2 Matrix

| Tabelle | SELECT admin | SELECT vorstand | SELECT trainer | SELECT self | SELECT fremd | INSERT | UPDATE | DELETE | Hinweise |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `members` | ✅ | ✅ minimiert | ⚠️ minimiert fachlich | ✅ own row | ❌ | ⚠️ staff | ⚠️ staff + self eingeschränkt | ⚠️ admin/vorstand | Public-Projektion statt offener Tabelle |
| `user_roles` | ✅ | ❌ optional read-only | ❌ | ✅ eigene Rollen | ❌ | ✅ admin | ✅ admin | ✅ admin | keine breite Rollenlesbarkeit |
| `roles` | ✅ | ⚠️ read-only falls nötig | ❌ | ❌ | ❌ | ✅ admin | ✅ admin | ❌/⚠️ admin-only | Systemrollen schützen |
| `season_cycles` | ✅ | ✅ | ✅ read-only | ✅ read-only | ✅ read-only | ⚠️ admin/vorstand | ⚠️ admin/vorstand | ⚠️ admin/vorstand | operative Stammdaten |
| `season_phases` | ✅ | ✅ | ✅ read-only | ✅ read-only | ✅ read-only | ⚠️ admin/vorstand | ⚠️ admin/vorstand | ⚠️ admin/vorstand | Phase ist breit lesbar |
| `teams` | ✅ | ✅ | ✅ | ✅ read-only | ✅ read-only | ⚠️ admin/vorstand | ⚠️ admin/vorstand/trainer | ⚠️ admin/vorstand | Teamstammdaten meist intern breit nutzbar |
| `team_members` | ✅ | ✅ | ✅ teambezogen | ⚠️ eigene Teaminfos | ❌ roh | ⚠️ admin/vorstand/trainer | ⚠️ admin/vorstand/trainer | ⚠️ admin/vorstand/trainer | Self eher über Projektion statt roher Join-Tabelle |
| `schedule_matches` | ✅ | ✅ | ✅ | ✅ read-only | ✅ read-only | ⚠️ admin/vorstand/trainer | ⚠️ admin/vorstand/trainer | ⚠️ admin/vorstand | `pin`/`code` ggf. separat schützen |
| `substitute_requests` | ✅ | ✅ | ✅ zuständigkeitsbezogen | ✅ eigene / betroffene | ❌ | ⚠️ self + staff | ⚠️ self eingeschränkt + staff | ⚠️ staff | sensible Verfügbarkeits-/Abwesenheitsdaten |
| `training_bookings` | ✅ | ✅ minimiert | ✅ beteiligungs-/trainerbezogen | ✅ eigene | ❌ | ⚠️ self + staff | ⚠️ self eingeschränkt + staff | ⚠️ self eingeschränkt + staff | keine breite Lesbarkeit aller Buchungen |
| `news` | ✅ | ✅ | ✅ | ✅ je Publikationsstatus | ✅ je Publikationsstatus | ⚠️ staff | ⚠️ staff | ⚠️ staff | interne und öffentliche News unterscheiden |
| `documents` | ✅ | ✅ kontextbezogen | ⚠️ kontextbezogen | ⚠️ kontextbezogen | ❌ | ⚠️ kontextbezogen | ⚠️ kontextbezogen | ⚠️ kontextbezogen | keine globale Dokument-Lesepolicy |
| `meetings` | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ admin/vorstand | ⚠️ admin/vorstand | ⚠️ admin/vorstand | Board-Meetings rein staff-intern |
| `deletion_requests` | ✅ | ✅ | ❌ | ✅ eigene | ❌ | ⚠️ self only + staff flow | ⚠️ nur Workflow | ❌ | Self nur für eigene `member_id` |
| `member_privacy_consents` / `member_consents` | ✅ | ✅ | ❌ | ✅ eigene | ❌ | ⚠️ via RPC | ⚠️ via RPC | ❌ | append-only Audit daneben |

## 3.3 Tabellenspezifische Zielregeln

### `members`

- Self darf eigene Zeile lesen.
- Staff darf Mitglieder lesen, aber die breite Lesbarkeit für alle Auth-User entfällt.
- Fremde Mitgliederdaten für normale Mitglieder nur über öffentliche/abgeleitete Views.
- Self-Update nur für klar erlaubte Felder wie persönliche Basisdaten, nicht für Rollen- oder Admin-Felder.

### `user_roles`

- normale Nutzer sehen nur eigene Rollen
- `vorstand` nicht automatisch alle Rollen
- Mutation ausschließlich `admin`, optional `developer` bei expliziter Governance

### `roles`

- kein offenes Rollenmodell für alle
- nur Admin-Fachbereich oder dedizierte Settings-Services lesen die volle Tabelle

### `season_cycles`, `season_phases`

- read-only für authentifizierte Nutzer vertretbar, wenn keine sensiblen Felder enthalten sind
- Write/Delete nur `admin|vorstand`

### `teams`, `team_members`

- Teams sind breit intern lesbar
- Rohdaten von Teamzuordnungen nicht pauschal für alle; Self eher über Team-ViewModel oder Service-Projektionen

### `schedule_matches`

- Matchstammdaten intern breit lesbar
- sensible operative Felder wie `pin`, `code`, interne Notizen optional über restriktivere View oder separate Read-Policy ausblenden

### `substitute_requests`

- Self liest nur eigene oder direkt betroffene Requests
- Staff liest zuständigkeitsbezogen, nicht global unbegrenzt ohne Fachbezug
- Write/Delete je Status und Ownership begrenzen

### `training_bookings`

- Self liest nur eigene Buchungen
- Trainer liest nur team-/slot- oder fachbezogene Buchungen
- keine globale Lesbarkeit aller Trainingsbuchungen für alle Nutzer

### `news`

- öffentliche News ggf. über Public-Policy oder View
- interne/unveröffentlichte News nur Staff oder Autor eigener Entwürfe

### `documents`

- kontextuelle Lesbarkeit nach Owner-/Board-/Kommunikationskontext
- keine globale `authenticated`-Lesepolicy

### `meetings`

- Board-Meetings nur `admin|vorstand`
- keine Lesbarkeit für normale Mitglieder oder Trainer

### `deletion_requests`

- Self-Insert nur für eigene `member_id`
- Statusänderungen nur Staff via Workflow-Policy / RPC
- kein Direkt-Delete

### `member_privacy_consents`

- Self liest und ändert nur eigene Consents
- Staff liest berechtigt, ändert nur via definierte Datenschutzprozesse
- kein Direkt-Delete

---

## 4. Beispielhafte SQL-Policy-Strategie

## 4.1 `members`

```sql
DROP POLICY IF EXISTS members_select_all_auth ON public.members;

CREATE POLICY members_select_self_or_staff
ON public.members
FOR SELECT TO authenticated
USING (
  public.is_member_self(id, auth.uid())
  OR public.has_permission(auth.uid(), 'member:read')
);

CREATE POLICY members_update_self_limited
ON public.members
FOR UPDATE TO authenticated
USING (
  public.is_member_self(id, auth.uid())
)
WITH CHECK (
  public.is_member_self(id, auth.uid())
);

CREATE POLICY members_update_staff
ON public.members
FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'member:write'))
WITH CHECK (public.has_permission(auth.uid(), 'member:write'));
```

Hinweis:

- Feldbeschränkungen für Self-Update werden zusätzlich über RPC oder Trigger abgesichert, da RLS nicht feldspezifisch ist.

## 4.2 `user_roles`

```sql
CREATE POLICY user_roles_select_self_or_admin
ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
);

CREATE POLICY user_roles_write_admin_only
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));
```

Analog für `UPDATE` und `DELETE`.

## 4.3 `deletion_requests`

```sql
CREATE POLICY deletion_requests_select_self_or_staff
ON public.deletion_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = member_id
      AND m.user_id = auth.uid()
  )
  OR public.is_admin_or_board(auth.uid())
);

CREATE POLICY deletion_requests_insert_self_only
ON public.deletion_requests
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.id = member_id
      AND m.user_id = auth.uid()
  )
  AND requested_by = auth.uid()
);
```

Statusübergänge sollten zusätzlich über RPC/Trigger validiert werden.

## 4.4 `member_privacy_consents`

```sql
CREATE POLICY privacy_consents_select_self_or_staff
ON public.member_privacy_consents
FOR SELECT TO authenticated
USING (
  public.is_member_self(member_id, auth.uid())
  OR public.is_admin_or_board(auth.uid())
);

-- Prefer no direct INSERT/UPDATE, only RPC.
```

## 4.5 `meetings`

```sql
CREATE POLICY meetings_select_staff_only
ON public.meetings
FOR SELECT TO authenticated
USING (public.is_admin_or_board(auth.uid()));
```

## 4.6 `documents`

Dokumente erfordern kontextuelle Policies:

- Board-Dokumente: nur `admin|vorstand`
- öffentliche Dokumente: ggf. veröffentlichter Kontext
- owner-/uploader-bezogene Dokumente: eigene plus zuständige Staff-Rollen

Regel:

- keine pauschale Lesepolicy auf die ganze Tabelle
- stattdessen kontextuelle `USING`-Klauseln oder dokumentbezogene Views

---

## 5. Rollentestmatrix

## 5.1 Kernmatrix

| Testfall | admin | vorstand | trainer | member_self | member_foreign |
|---|---:|---:|---:|---:|---:|
| eigene `members`-Zeile lesen | ✅ | ✅ | ✅ | ✅ | n/a |
| fremde `members`-Zeile roh lesen | ✅ | ✅ begrenzt | ⚠️ nur fachbezogen | ❌ | ❌ |
| eigene `user_roles` lesen | ✅ | ✅ | ✅ | ✅ | n/a |
| fremde `user_roles` lesen | ✅ | ❌ | ❌ | ❌ | ❌ |
| `roles` lesen | ✅ | ⚠️ wenn freigegeben | ❌ | ❌ | ❌ |
| `season_cycles` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `season_phases` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `teams` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `team_members` roh lesen | ✅ | ✅ | ✅ zuständigkeitsbezogen | ❌ | ❌ |
| `schedule_matches` lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| `substitute_requests` eigene lesen | ✅ | ✅ | ✅ falls zuständig | ✅ | ❌ |
| `training_bookings` eigene lesen | ✅ | ✅ | ✅ falls zuständig | ✅ | ❌ |
| `news` unveröffentlicht lesen | ✅ | ✅ | ⚠️ staff/author only | ❌ | ❌ |
| `documents` board-intern lesen | ✅ | ✅ | ❌ | ❌ | ❌ |
| `meetings` lesen | ✅ | ✅ | ❌ | ❌ | ❌ |
| eigene `deletion_requests` lesen | ✅ | ✅ | ❌ | ✅ | ❌ |
| fremde `deletion_requests` lesen | ✅ | ✅ | ❌ | ❌ | ❌ |
| eigene `privacy_consents` lesen | ✅ | ✅ | ❌ | ✅ | ❌ |
| fremde `privacy_consents` lesen | ✅ | ✅ | ❌ | ❌ | ❌ |

## 5.2 Negative Pflicht-Tests

- normales Mitglied liest fremde `user_roles` -> muss fehlschlagen
- normales Mitglied liest fremde `deletion_requests` -> muss fehlschlagen
- Trainer liest `meetings` -> muss fehlschlagen
- Mitglied erstellt `deletion_request` für fremde `member_id` -> muss fehlschlagen
- Mitglied updatet `privacy_consents` direkt ohne RPC -> muss fehlschlagen, falls direkte Writes gesperrt sind
- Dokument-SELECT ohne passenden Kontext -> muss fehlschlagen

## 5.3 Testansatz

- SQL-Policy-Tests pro Rolle / Claim-Set
- Positiv- und Negativtests pro Tabelle
- Snapshot-Tests für erlaubte Resultsets
- Workflow-Tests für Statusübergänge bei `deletion_requests`

---

## 6. Risikoanalyse

## 6.1 Vertraulichkeit

Hauptrisiken:

- offene `SELECT`-Policies auf `members`, `user_roles`, `documents`, `meetings`, `communication`-nahen Tabellen
- Trainings-, Ersatz- und Datenschutzdaten können sensible Verhaltens- oder Gesundheitsnähe haben

Gegenmaßnahmen:

- deny-by-default
- Public-Views statt offener Basistabellen
- staff- und self-spezifische Policies

## 6.2 Integrität

Hauptrisiken:

- fehlende `WITH CHECK`-Klauseln bei `UPDATE`
- Statussprünge ohne Workflowprüfung
- Rollen-/Rechteänderungen mit zu weiter Schreibfreigabe

Gegenmaßnahmen:

- `WITH CHECK` überall bei `UPDATE`
- RPC/Trigger für Workflowtabellen
- Admin-only Mutations auf `user_roles` und `roles`

## 6.3 Rekursion und Policy-Komplexität

Hauptrisiken:

- Policies referenzieren andere RLS-geschützte Tabellen direkt
- zyklische Abhängigkeiten zwischen `user_roles`, `members` und Fachtabellen

Gegenmaßnahmen:

- nur `SECURITY DEFINER`-Hilfsfunktionen für Rollenchecks
- Ownership-Prüfungen möglichst kapseln
- fachliche Projektionen per Views statt tiefer Policy-Joins

## 6.4 Compliance und Datenschutz

Hauptrisiken:

- zu breite Sichtbarkeit personenbezogener Daten
- fehlende Trennung public/internal
- unzureichende Nachvollziehbarkeit sensibler Änderungen

Gegenmaßnahmen:

- Projection-Views
- Privacy-Domain mit eigener Audit- und Workflow-Schicht
- Datenminimierung pro Rolle und Modul

---

## 7. Umsetzungsreihenfolge

1. Hilfsfunktionen für Rollen, Permissions und Ownership härten.
2. Auf allen produktiven Tabellen `FORCE RLS` setzen.
3. Offene `SELECT USING (true)`-Policies tabellenweise ablösen.
4. Public-/Internal-Views für Mitglieder und weitere sensible Domänen ergänzen.
5. Workflowtabellen (`deletion_requests`, `privacy_consents`) auf RPC-gestützte Mutationspfade umstellen.
6. Rollentestmatrix automatisieren und als Release-Gate verwenden.

## 8. Beziehung zum Bestand

Dieses Dokument baut auf und konsolidiert:

- `docs/security/rls_permissions_review_2026-04-01.md`
- `docs/security/privacy_rls_target_structure_2026-04-02.md`

Es erweitert diese vorhandenen Analysen zu einem vollständigen tabellenübergreifenden Ziel-RLS-Design für die produktiven Domänenobjekte.
