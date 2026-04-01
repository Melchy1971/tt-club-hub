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
- **Zentrale Permission-Matrix** in `src/settings/permissions.ts`.
- **Stabile Typen** in `src/settings/types.ts` (`SettingsSubpageId`, `SettingsSubpageDef`).
- **Wiederverwendbare Section-Layouts** in `src/settings/sectionLayouts.ts`.
- **UI-Shell** in `src/pages/SettingsPage.tsx` rendert Navigation + aktive Komponente aus der Registry.
- Query-Param `tab=<subpageId>` steuert Deep-Linking.

Damit werden Navigation, Zugriff und Section-Struktur an einer Stelle gepflegt.

---

## 2) Typen

### Kern-Typen (`src/settings/types.ts`)
- `SettingsSubpageId`: Union aller zulässigen Subseiten-IDs.
- `SettingsSubpageGroup`: logische Gruppierung (`account | club | admin`).
- `SettingsSubpageDef`:
  - `requiredPermission` für Sichtbarkeit,
  - `writePermission` für mutierende Aktionen.
- `SettingsAccessContext`: einheitlicher Access-Input (`role`).

Zusätzlich bleibt der bestehende `UseSettingsForm*`-Typsatz in `src/types/settings.ts` die Basis für typed Form-Flows.

---

## 3) Gemeinsame Utilities

### Access-Utilities (`src/settings/access.ts`)
- `canAccessSettingsPage(page, ctx)`
  - Read-Zugriff / Sichtbarkeit.
- `canWriteSettingsPage(page, ctx)`
  - Schreibzugriff (fällt auf `requiredPermission` zurück, falls kein `writePermission` gesetzt ist).

### Schema-Utilities (`src/settings/schemas.ts`)
- `trimmedString(max)`
- `optionalTrimmedString(max)`
- `emailSchema`
- `optionalUrlSchema`
- `booleanWithDefault(defaultValue)`

Damit werden Feldregeln über Subseiten hinweg vereinheitlicht.

### Form/Dirty-Utilities (`src/settings/formUtils.ts`)
- `hasFormErrors(form)`
- `createDirtyStateSummary(form)` (inkl. rekursiver Pfadauflösung für verschachtelte Form-Felder)
- `mapNullableToEmptyString(input)`

Damit ist Dirty-State-Handling über Seiten konsistent und robust.

### Section-Layout-Utilities (`src/settings/sectionLayouts.ts`)
- `SETTINGS_SECTION_LAYOUTS`
  - deklarative Section-Definitionen je Subseite (`title`, `description`, `variant`).
- `getSectionLayoutsForPage(id)`
  - konsumierbare Helper-Funktion für Komponenten.

---

## 4) Berechtigungsmodell je Subseite

### Prinzip
- `requiredPermission` regelt, ob eine Subseite sichtbar/lesbar ist.
- `writePermission` regelt, ob Formulare/Mutationen auf der Seite erlaubt sind.
- Auflösung erfolgt zentral via `hasPermission(role, permission)`.

### Quelle der Wahrheit (`src/settings/permissions.ts`)
- `SETTINGS_PERMISSION_MODEL: Record<SettingsSubpageId, SettingsPermissionRule>`
- `getSettingsPermissionRule(subpageId)`

### Belegung im Modell
- **Ohne spezielle Permission**: `general`, `profile`, `appearance`, `notifications`, `privacy`, `security`.
- **Club-Admin-Ebene**:
  - `club`, `season`, `venues`: `read = settings:read`, `write = settings:write`.
- **System-Admin-Ebene**:
  - `roles`, `backup`, `danger`: `read = admin:all`, `write = admin:all`.

---

## 5) Umsetzungshinweise (nächste Iteration)

1. Seiten-intern bei mutierenden Aktionen explizit `canWriteSettingsPage(...)` nutzen (Buttons disabled/hidden).
2. Bestehende Zod-Schemas sukzessive auf `src/settings/schemas.ts` konsolidieren.
3. Für einheitliche UI-Sections durchgehend `SettingsSection` + `SettingsSaveBar` verwenden.
4. Optional: Registry um `featureFlag`/`beta` erweitern, falls Subseiten schrittweise ausgerollt werden.
