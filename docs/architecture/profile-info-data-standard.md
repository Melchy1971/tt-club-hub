# Standardisierte Datenversorgung: Profil & Info

## Query-Plan

### 1) Member-ViewModel (`profileInfoService.getMemberProfileViewModel`)
1. `members` per `user_id` laden (Single Row).
2. Parallel zusammengesetzte Queries laden:
   - `user_roles` per `user_id`
   - `team_members` + Join `teams(name, league)` per `member_id`
3. Ergebnisse in ein gemeinsames ViewModel aggregieren:
   - `member`
   - `roles[]`
   - `teams[]`

**Ziel:** UI (Profilseite) nutzt nur ein konsistentes Datenobjekt statt separater Einzelqueries.

### 2) Öffentliche Club-Info (`profileInfoService.getPublicClubInfo`)
1. Nur aus `club_public_info` lesen (View).
2. Kein direkter Read von `club_settings` im Info-Screen.

**Ziel:** öffentliche/sichere Informationen sind strukturell von internen Einstellungen getrennt.

## Typen

Neue App-Typen in `src/types/viewModels.ts`:
- `MemberRoleBadge`
- `MemberTeamBadge`
- `MemberProfileViewModel`
- `PublicClubInfoViewModel`

Nutzen:
- klare Contract-Typen zwischen Service- und UI-Schicht,
- weniger ad-hoc `any`-Strukturen,
- standardisierte Darstellung für Rollen/Teams.

## Sicherheitsprüfung

Umgesetzt per Migration `20260401101500_profile_info_public_split.sql`:

1. **Public Read Model**
   - View `public.club_public_info` erstellt.
   - `GRANT SELECT` auf `anon` + `authenticated`.

2. **Interne Club-Daten abgesichert**
   - offene Select-Policy auf `club_settings` entfernt.
   - neue Read-Policy: nur `admin`, `vorstand`, `developer`.

3. **Member-Read-Model (Profilfokus)**
   - View `public.member_profile_view` als explizites Profil-Lesemodell erstellt.

### Checkliste für Verifikation
- [ ] Als anonymer Nutzer: `select * from club_public_info` funktioniert.
- [ ] Als normal authentifizierter Nutzer ohne Admin/Vorstand/Developer: `select * from club_settings` liefert keine Rows.
- [ ] Profilseite zeigt Rollen/Teams weiterhin vollständig via ViewModel.
