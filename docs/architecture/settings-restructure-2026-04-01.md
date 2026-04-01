# Settings-Refactoring (Subseitenmodell + Access + Shared Patterns)

## 1) Strukturvorschlag

### Zielbild
Der Settings-Bereich wird als **Subseitenmodell** mit stabilen IDs geführt:

- `general`
- `roles`
- `profile`
- `club`
- `season`
- `venues`
- `appearance`
- `notifications`
- `privacy`
- `security`
- `backup`
- `danger`

### Architektur
- **Zentrale Subseiten-Registry** in `src/settings/subpages.ts`.
- **Stabile Typen** in `src/settings/types.ts` (`SettingsSubpageId`, `SettingsSubpageDef`).
- **UI-Shell** in `SettingsPage` rendert Navigation + aktive Komponente nur aus Registry.
- Query-Param `tab=<subpageId>` steuert Deep-Linking.

Das ermöglicht:
- klare Erweiterbarkeit (neue Subseite = 1 Eintrag in Registry),
- konsistente Navigation,
- deklarative Zugriffskontrolle je Subseite.

---

## 2) Typen

### Kern-Typen
- `SettingsSubpageId`: Union aller zulässigen Subseiten-IDs.
- `SettingsSubpageGroup`: logische Gruppierung (`account | club | admin`).
- `SettingsSubpageDef`:
  - `requiredPermission` für Sichtbarkeit,
  - `writePermission` für mutierende Aktionen.

Zusätzlich bleibt der bestehende `UseSettingsForm*`-Typsatz in `src/types/settings.ts` die Basis für typed Form-Flows.

---

## 3) Gemeinsame Utilities

### Access-Utilities (`src/settings/access.ts`)
- `canAccessSettingsPage(page, ctx)`
  - prüft Read-Zugriff / Sichtbarkeit.
- `canWriteSettingsPage(page, ctx)`
  - prüft Schreibzugriff (fällt auf `requiredPermission` zurück, falls kein `writePermission` gesetzt ist).

### Schema-Utilities (`src/settings/schemas.ts`)
- `trimmedString(max)`
- `optionalTrimmedString(max)`
- `emailSchema`
- `optionalUrlSchema`
- `booleanWithDefault(defaultValue)`

Damit werden Feldregeln über Subseiten hinweg vereinheitlicht.

### Form/Dirty-Utilities (`src/settings/formUtils.ts`)
- `hasFormErrors(form)`
- `createDirtyStateSummary(form)`
- `mapNullableToEmptyString(input)`

Diese Funktionen vereinheitlichen Dirty-State-Logik und Mapping von DB-Werten für Form-Initialisierung.

---

## 4) Berechtigungsmodell je Subseite

### Prinzip
- `requiredPermission` regelt, ob eine Subseite sichtbar/lesbar ist.
- `writePermission` regelt, ob Formulare/Mutationen auf der Seite erlaubt sind.
- Auflösung erfolgt zentral via `hasPermission(role, permission)`.

### Belegung im Modell
- **Ohne spezielle Permission**: `general`, `profile`, `appearance`, `notifications`, `privacy`, `security`.
- **Club-Admin-Ebene**:
  - `club`, `season`, `venues`: `requiredPermission: settings:read`, `writePermission: settings:write`.
- **System-Admin-Ebene**:
  - `roles`, `backup`, `danger`: `requiredPermission: admin:all`, `writePermission: admin:all`.

---

## 5) Umsetzungshinweise (nächste Iteration)

1. Seiten-intern bei mutierenden Aktionen explizit `canWriteSettingsPage(...)` nutzen (Button disabled/hidden).
2. Bestehende Zod-Schemas sukzessive auf `src/settings/schemas.ts` konsolidieren.
3. Für einheitliche UI-Sections durchgehend `SettingsSection` + `SettingsSaveBar` verwenden.
4. Optional: Registry um `featureFlag`/`beta` erweitern, falls Subseiten schrittweise ausgerollt werden.
