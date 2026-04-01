# Board-Domain (Vorstand) – Architektur, APIs, Berechtigungen, Risiken

## Zielbild

Die Board-Domain kapselt folgende Bereiche:
- `boardMemberService`
- `boardMeetingService`
- `meetingDocumentService`
- News, Meetings, Dokumente, E-Mail und Listen als fachliche Kanäle

### Trennung intern vs. öffentlich

- **Sitzungen + Sitzungsdokumente sind immer intern**.
- **Dokumente und News** werden als `visibility = public | internal` behandelt.
- **Listen + E-Mail** übernehmen dieselbe `visibility` und werden über dieselben Board-Regeln geschützt.

## Service-APIs

### 1) `boardMemberService`
- `listActive()`
- `listActiveForActor(role)` (nur `admin|developer|vorstand`)

### 2) `boardMeetingService`
- `list(filter)`
- `listAll()`
- `listForActor(role, filter)`
- `getById(id)`
- `create(payload)`
- `createForActor(role, payload)`
- `update(id, payload)`
- `updateForActor(role, id, payload)`
- `remove(id)`
- `removeForActor(role, id)`

### 3) `meetingDocumentService`
- `list(meetingId, filter)`
- `listForActor(role, meetingId, filter)`
- `getById(id)`
- `upload(meetingId, file, payload)`
- `uploadForActor(role, meetingId, file, payload)`
- `remove(id)`
- `removeForActor(role, id)`

### 4) `boardDomainService` (Fassade)
- `listNews(role, filter)`
- `listMeetings(role)`
- `listMeetingDocuments(role, meetingId)`
- `listDocuments(role, visibility)`
- `listDistributionLists(role, visibility)`
- `buildEmailDraft(role, input)`

## Typen

Die Board-Domain nutzt zentrale Typen in `src/types/domain/board.ts`:
- `BoardActorRole`
- `BoardChannel`
- `BoardVisibility`
- `BoardScope`
- `BoardPermissionRule`
- `BoardNewsFilter`
- `BoardMeetingFilter`
- `BoardDocumentFilter`
- `BoardEmailDraft`
- `BoardDistributionList`

## Berechtigungsregeln

Die Regeln sind in `boardAccessPolicy` hinterlegt.

| Rolle | internal read | internal write | internal delete | public read | public write | public delete |
|---|---:|---:|---:|---:|---:|---:|
| developer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| vorstand | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| trainer | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| spieler | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| mitglied | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

## Risikoanalyse

1. **Service-only-Schutz ist nicht ausreichend (hoch)**
   - Risiko: Direkte DB-/Storage-Zugriffe umgehen Service-Regeln.
   - Maßnahme: RLS-Policies + private Storage-Buckets ergänzen.

2. **Meeting-Dokumente nutzen Public-URLs (hoch)**
   - Risiko: URL-Leak macht interne Dateien öffentlich.
   - Maßnahme: Signed URLs mit kurzer TTL statt `getPublicUrl`.

3. **Fehlende native Visibility-Spalten (mittel)**
   - Risiko: Fachliche Trennung hängt an Konventionen (z. B. Kategorie/Filter).
   - Maßnahme: Schema-Migration (`visibility`-Feld) in `news`, `documents`, ggf. `meetings`.

4. **Delete-Rechte für Vorstand bewusst eingeschränkt (mittel)**
   - Risiko: Operative Blocker ohne Admin-Verfügbarkeit.
   - Maßnahme: Freigabeprozess (Soft-Delete + Admin-Review) statt Hard-Delete.

5. **Verteilungslisten-Mutationen ohne Transaktion (mittel)**
   - Risiko: Inkonsistente Listenstände bei Fehlern.
   - Maßnahme: RPC/Transaktionsfunktion für `setMembers`.

## Nächste Schritte

1. DB-Migration für `visibility` und RLS-Härtung.
2. Storage-Strategie auf private Buckets/signed URLs umstellen.
3. Board-Page sukzessive auf `boardDomainService` migrieren.
