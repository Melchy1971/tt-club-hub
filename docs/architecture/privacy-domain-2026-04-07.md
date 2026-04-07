# Datenschutz-Domain – 2026-04-07

## Zielbild

Die Datenschutz-Domain bündelt drei fachlich getrennte, aber zusammenhängende Bereiche:

- **Privacy Consents** über `member_privacy_consents`
- **Consent Audit** über `consent_audit_log`
- **Deletion Workflow** über `deletion_requests`

Die Domain folgt diesen Leitprinzipien:

- **privacy-by-design**
- **deny-by-default**
- **Datenminimierung je Rolle und Anwendungsfall**
- **Self-Service und Admin-Bearbeitung strikt trennen**
- **kritische Änderungen nur über definierte Service-/RPC-Kanäle**

---

## 1. Datenmodell

## 1.1 `member_privacy_consents`

### Zweck

`member_privacy_consents` modelliert den aktuellen fachlichen Einwilligungsstand pro Mitglied und Consent-Typ.

### Zielmodell

```ts
type PrivacyConsentType =
  | 'profile_visibility'
  | 'email_visibility'
  | 'phone_visibility'
  | 'photo_usage'
  | 'marketing_communication';

type PrivacyConsentStatus = 'granted' | 'revoked';

interface MemberPrivacyConsent {
  id: string;
  memberId: string;
  consentType: PrivacyConsentType;
  status: PrivacyConsentStatus;
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'other';
  source: 'self_service' | 'admin_portal' | 'import' | 'system';
  grantedAt: string | null;
  revokedAt: string | null;
  grantedBy: string | null;
  revokedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Modellregeln

- genau ein aktueller Datensatz pro `memberId + consentType`
- `status = granted` erfordert `grantedAt`
- `status = revoked` erfordert `revokedAt`
- keine parallelen widersprüchlichen Zustände
- Audit-Historie wird nicht im Consent-Datensatz selbst, sondern im Audit-Log geführt

### Abgrenzung zum Ist-Zustand

Aktuell arbeitet das Frontend noch gegen `member_consents` mit booleschem `granted`. Zielbild ist ein fachlich expliziteres Modell mit `status`, `source`, `granted_by` und `revoked_by`.

## 1.2 `consent_audit_log`

### Zweck

`consent_audit_log` ist die unveränderliche Historie aller relevanten Datenschutzänderungen.

### Zielmodell

```ts
type ConsentAuditAction =
  | 'consent_granted'
  | 'consent_revoked'
  | 'consent_migrated'
  | 'consent_corrected';

interface ConsentAuditEntry {
  id: string;
  consentId: string | null;
  memberId: string;
  consentType: PrivacyConsentType;
  action: ConsentAuditAction;
  changedBy: string | null;
  changedByRole: string | null;
  changedAt: string;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  details: Record<string, unknown>;
}
```

### Audit-Mindestfelder

Gefordert und verpflichtend:

- `changedBy`
- `changedAt`
- `ip`
- `userAgent`

Zusätzlich empfohlen:

- `changedByRole`
- `requestId`
- `details.oldStatus`
- `details.newStatus`
- `details.source`

### Modellregeln

- Audit-Einträge sind append-only
- kein UPDATE, kein DELETE
- IP und User-Agent stammen idealerweise serverseitig aus vertrauenswürdigem Kontext; Clientwerte nur fallback

## 1.3 `deletion_requests`

### Zweck

`deletion_requests` modelliert den DSGVO-Löschworkflow als fachlichen Prozess und nicht nur als Tabelle für Löschwünsche.

### Zielmodell

```ts
type DeletionRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'executing'
  | 'completed'
  | 'failed';

interface DeletionRequest {
  id: string;
  memberId: string;
  requestedBy: string;
  status: DeletionRequestStatus;
  requestReason: string | null;
  decisionNote: string | null;
  legalHold: boolean;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  executionStartedAt: string | null;
  completedAt: string | null;
  actorIp: string | null;
  actorUserAgent: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Modellregeln

- Self-Service erzeugt nur Requests für die eigene `memberId`
- `legalHold = true` blockiert Ausführung
- Statuswechsel laufen über definierte Transitionen, nicht durch freie Updates
- `approved` ist nicht gleich `completed`; fachliche Prüfung und Ausführung bleiben getrennt

---

## 2. Service-API

## 2.1 Zielstruktur

```text
src/
  services/
    privacy/
      privacy.types.ts
      privacy.mapper.ts
      privacy.service.ts
      consent.service.ts
      consent-audit.service.ts
      deletion-request.service.ts
      privacy-visibility.service.ts
```

Übergangsweise kann `src/services/privacyService.ts` als Fassade bestehen bleiben und intern auf diese Domänendienste delegieren.

## 2.2 Consent-Service

```ts
interface ConsentService {
  listForSelf(memberId: string): Promise<ApiResult<MemberPrivacyConsent[]>>;
  listForAdmin(memberId: string): Promise<ApiResult<MemberPrivacyConsent[]>>;
  setConsent(input: SetConsentInput, context: PrivacyAuditContext): Promise<ApiResult<MemberPrivacyConsent>>;
  getVisibilitySnapshot(memberId: string, viewer: PrivacyViewerContext): Promise<ApiResult<PrivacyVisibilitySnapshot>>;
}
```

### Regeln

- Self-Service darf nur eigene Consents lesen und ändern
- Admin-/Vorstandsmodus darf fremde Consents lesen; Änderungen nur über definierte Admin-Policy
- `setConsent()` schreibt atomar Consent + Audit, idealerweise via RPC

## 2.3 Consent-Audit-Service

```ts
interface ConsentAuditService {
  listOwnAudit(memberId: string): Promise<ApiResult<ConsentAuditEntry[]>>;
  listAdminAudit(memberId: string): Promise<ApiResult<ConsentAuditEntry[]>>;
  appendAudit(entry: ConsentAuditWriteModel): Promise<ApiResult<void>>;
}
```

### Regeln

- Self-Service sieht nur eigene Audit-Ereignisse
- Admin/Vorstand sieht Audit für berechtigte Fälle
- Schreiben erfolgt nur intern durch Service/RPC, nie direkt aus Komponenten

## 2.4 Deletion-Request-Service

```ts
interface DeletionRequestService {
  listOwnRequests(memberId: string): Promise<ApiResult<DeletionRequest[]>>;
  listAdminRequests(query?: ListQuery<DeletionRequestFilter, DeletionRequestSortField>): Promise<ApiResult<PaginatedData<DeletionRequestAdminViewModel>>>;
  createSelfRequest(input: CreateDeletionRequestInput, context: PrivacyAuditContext): Promise<ApiResult<DeletionRequest>>;
  transitionRequest(input: TransitionDeletionRequestInput, context: PrivacyAuditContext): Promise<ApiResult<DeletionRequest>>;
  getById(id: string): Promise<ApiResult<DeletionRequest | null>>;
}
```

### Regeln

- Self-Service darf nur `createSelfRequest()` und `listOwnRequests()`
- Admin-/Vorstand-Bearbeitung läuft nur über `transitionRequest()`
- illegale Statuswechsel werden service- und DB-seitig blockiert

## 2.5 Privacy-Visibility-Service

```ts
interface PrivacyVisibilityService {
  resolveMemberFieldVisibility(input: ResolveVisibilityInput): Promise<ApiResult<MemberVisibilityDecision>>;
  resolveProfileProjection(input: ResolveProfileProjectionInput): Promise<ApiResult<MemberProfileProjection>>;
}
```

Zweck:

- Datenminimierung und Rollensicht zentral auswerten
- UI-Komponenten erhalten nur bereits gefilterte Sichtmodelle

---

## 3. Workflow-Regeln

## 3.1 Consent-Workflow

### Self-Service

1. Nutzer lädt eigene Consent-Sicht.
2. Nutzer ändert genau einen Consent.
3. Service validiert Ownership.
4. Service oder RPC schreibt atomar:
   - aktuellen Consent-Zustand
   - Audit-Eintrag mit `changedBy`, `changedAt`, `ip`, `userAgent`
5. UI erhält aktualisierten Consent und aktualisierte Historie.

### Admin-Bearbeitung

Nur erlaubt, wenn fachlich notwendig, etwa Korrektur oder Migration.

Zusatzregeln:

- Admin-Änderungen sind im Audit als solche markiert
- der Grund der Korrektur gehört in `details`

## 3.2 Deletion-Workflow

### Erlaubte Transitionen

- `pending -> in_review | cancelled`
- `in_review -> approved | rejected | cancelled`
- `approved -> executing | cancelled`
- `executing -> completed | failed`
- `failed -> executing | cancelled`
- `rejected`, `cancelled`, `completed` sind terminal

### Self-Service-Regeln

- Nutzer darf nur eigene Request anlegen
- Nutzer darf nur `pending` Requests selbst stornieren, wenn dies fachlich erlaubt ist
- Nutzer darf keinen Approval- oder Execution-Status setzen

### Admin-/Vorstand-Regeln

- nur Staff darf `in_review`, `approved`, `rejected`, `executing`, `completed`, `failed` setzen
- `legalHold` blockiert Übergang zu `executing` und `completed`
- jeder Transition-Schritt ist auditpflichtig

## 3.3 Trennung Self-Service vs. Admin

### Self-Service-Bereich

- eigene Consents lesen
- eigene Audit-Historie lesen
- eigene Löschanfragen lesen
- eigene Löschanfrage anlegen

### Admin-Bereich

- fremde Datenschutzdaten nur in minimierter, zweckgebundener Form sehen
- Statusbearbeitung, Review und Audit-Ansicht
- keine breitflächige Einsicht in personenbezogene Daten ohne Zweckbezug

---

## 4. Sicherheitsregeln

## 4.1 Datenminimierung je Rolle

### `mitglied` / `spieler`

- nur eigene Consent-Daten
- nur eigene Audit-Ereignisse
- nur eigene Löschanfragen
- keine fremden Datenschutzdaten

### `trainer`

- standardmäßig keine Datenschutz-Admin-Rechte
- Sichtbarkeit fremder Kontaktfelder nur über separate fachliche Regeln, nicht über Privacy-Domain-Adminrechte

### `vorstand`

- Zugriff auf Review- und Bearbeitungsfunktionen für Datenschutzprozesse
- nur minimierte personenbezogene Daten in Admin-Listen
- kein pauschaler Vollzugriff auf alle Rohdaten ohne Zweckbezug

### `admin`

- voller operativer Zugriff auf Datenschutzprozesse
- Audit- und Workflowzugriff gemäß RLS und Service-Policy

### `developer`

- nicht automatisch Datenschutz-Fachrolle
- nur explizit zulassen, wenn dies organisatorisch gewollt ist

## 4.2 Sichtbarkeitsgrenzen

- Privacy-UI für Self-Service zeigt nie fremde Personen
- Admin-Listen zeigen nur die minimal nötigen Felder: z. B. Name, Status, Zeitpunkte, aber nicht automatisch vollständige Profildaten
- Consent-Audit enthält sensible Telemetriedaten und ist nur für berechtigte Rollen sichtbar

## 4.3 Änderungsregeln

- direkte Tabellenupdates aus UI-Komponenten sind unzulässig
- Consent-Änderungen und Statusübergänge nur über Service oder RPC
- Audit-Log nur append-only

## 4.4 RLS-Grundsätze

- `FORCE ROW LEVEL SECURITY`
- keine globale `USING (true)`-Policy für datenschutzkritische Tabellen
- Staff-Checks nur über rekursionsfreie Hilfsfunktionen wie `has_role` / `is_staff`

## 4.5 Vertrauensmodell für Metadaten

- `ip` und `user_agent` möglichst serverseitig ermitteln
- Client-seitige Kontextdaten nur als Fallback oder Zusatzinformation verwenden

---

## 5. Edge Cases

## 5.1 Consents

- Consent-Typ ist unbekannt oder veraltet.
  Regel: ablehnen oder als Migrationsfall mit eigenem Audit-Action-Typ behandeln.
- Consent wird mehrfach parallel geändert.
  Regel: letzter gültiger atomarer Write gewinnt; Audit zeigt beide Versuche.
- Self-Service sendet denselben Zustand erneut.
  Regel: idempotent behandeln, optional kein neuer Audit-Eintrag ohne echte Änderung.

## 5.2 Audit

- `changedBy` ist unbekannt, etwa bei Systemmigration.
  Regel: `changedBy = null`, `changedByRole = 'system'` oder entsprechender Source-Marker.
- `ip` oder `user_agent` fehlen.
  Regel: erlaubt, aber als unvollständiger Audit-Kontext kennzeichnen.
- Audit-Schreiben schlägt fehl.
  Regel: Consent-/Workflow-Änderungen sollten im Idealfall transaktional mit Audit verbunden sein; bei nicht-transaktionalem Fallback muss Fehler explizit sichtbar werden.

## 5.3 Löschanfragen

- Nutzer hat bereits eine offene Request.
  Regel: zweite Self-Service-Request blockieren oder mit existierender verknüpfen.
- `legalHold = true`, aber Admin versucht `executing`.
  Regel: harter Fehler.
- Request wurde parallel bereits reviewed.
  Regel: Transition gegen aktuellen Status validieren, nicht gegen veraltete UI-Daten.
- Löschung schlägt nach `executing` technisch fehl.
  Regel: Status `failed` mit Fehlerdetails und möglichem Retry-Pfad.

## 5.4 Sichtbarkeit

- Vorstandsmitglied sieht mehr Daten als nötig, weil UI Rohdaten statt Projektionen nutzt.
  Regel: Sichtbarkeitsentscheidung in Services, nicht in Komponenten.
- Consent beeinflusst Profilsicht in anderen Domänen nicht konsistent.
  Regel: zentrale `PrivacyVisibilityService`-Entscheidung statt verstreuter Feldprüfungen.

## 5.5 Aktueller Codebestand

- `SettingsPrivacy.tsx` enthält heute direkte Tabellenzugriffe und eigene Consent-Typdefinitionen.
  Regel: auf Privacy-Services migrieren.
- `privacyService.ts` ist heute funktional, aber fachlich noch nicht vollständig getrennt in Consent-, Audit- und Deletion-Subservices.
  Regel: in klarere Domain-Services aufspalten.

---

## 6. Konkrete Empfehlungen

1. `member_consents` fachlich auf ein explizites Consent-Domain-Modell mit `status`, `source` und Actor-Feldern weiterentwickeln.
2. `consent_audit_log` um `changed_by`, `changed_by_role`, `changed_at`, `ip`, `user_agent` als Pflichtkontext definieren.
3. `deletion_requests` mit vollständiger Statusmaschine inklusive `in_review` und `failed` modellieren.
4. Self-Service- und Admin-APIs klar trennen statt dieselben Funktionen mit impliziten Kontextannahmen zu überladen.
5. Datenminimierung über dedizierte Sichtmodelle und Visibility-Services erzwingen.
6. `SettingsPrivacy.tsx` auf Privacy-Domain-Services migrieren und direkte Supabase-Zugriffe entfernen.

## 7. Beziehung zum Ist-Zustand

Diese Zielarchitektur baut auf folgendem Bestand auf:

- `src/services/privacyService.ts`
- `src/types/privacy.ts`
- `docs/security/privacy_rls_target_structure_2026-04-02.md`

Sie schließt insbesondere diese Lücken:

- direkte Datenschutzlogik in `SettingsPrivacy.tsx`
- zu schwache Trennung zwischen Self-Service und Admin-Bearbeitung
- Audit-Metadaten im Code noch nicht vollständig modelliert
- Deletion-Workflow fachlich noch nicht vollständig im Service-Layer verankert
