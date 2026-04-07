# Settings-Zielarchitektur – 2026-04-07

## Zielbild

Der Settings-Bereich wird als eigenständige, klar strukturierte Konfigurationsdomäne organisiert. Jede Unterseite ist ein deklarativ registrierter Knoten mit:

- eigener Access-Control für Lesen und Schreiben
- klarer Gruppenzuordnung
- eigener Abschnittsdefinition
- eigener Form- und Service-Verantwortung
- zentralen Labels und Metadaten

Leitregeln:

- **Keine Business-Logik direkt in Settings-Komponenten.**
- **Settings-Komponenten orchestrieren nur Form, Sections und UI.**
- **Laden, Speichern, Mapping, Dirty-State-Handling und Rechteprüfung laufen über gemeinsame Utilities und Services.**

---

## 1. Settings-Struktur

## 1.1 Vollständige Unterseiten

Die Zielstruktur umfasst genau diese Unterseiten:

- Rollen
- Rollen & Rechte
- Mein Profil
- Vereinsdaten
- Saisonverwaltung
- Spiellokale
- Darstellung
- Benachrichtigungen
- Datenschutz
- Sicherheit
- Backup
- Gefahrenzone

## 1.2 Ziel-Registry

```text
src/
  settings/
    types.ts
    access.ts
    permissions.ts
    labels.ts
    sectionLayouts.ts
    subpages.ts
    formUtils.ts
    pageContracts.ts
    pageRegistry.ts
  components/
    settings/
      SettingsRoles.tsx
      SettingsPermissions.tsx
      SettingsProfile.tsx
      SettingsClub.tsx
      SettingsSeasons.tsx
      SettingsVenues.tsx
      SettingsAppearance.tsx
      SettingsNotifications.tsx
      SettingsPrivacy.tsx
      SettingsSecurity.tsx
      SettingsBackup.tsx
      SettingsDangerZone.tsx
      shared/
        SettingsPageShell.tsx
        SettingsFormActions.tsx
        SettingsSectionCard.tsx
```

## 1.3 Gruppenmodell

Empfohlene Gruppen:

- `account`
  Mein Profil, Darstellung, Benachrichtigungen, Datenschutz, Sicherheit
- `club`
  Vereinsdaten, Saisonverwaltung, Spiellokale
- `admin`
  Rollen, Rollen & Rechte, Backup, Gefahrenzone

Die frühere Unterseite `general` ist nicht Teil des Zielbilds und sollte entfallen oder in eine reine Info-/Read-only-Seite außerhalb dieses Kernmodells verschoben werden.

---

## 2. Typen

## 2.1 Unterseiten-ID

```ts
type SettingsSubpageId =
  | 'roles'
  | 'permissions'
  | 'profile'
  | 'club'
  | 'season'
  | 'venues'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'backup'
  | 'danger';
```

## 2.2 Seitenvertrag

Jede Unterseite erhält einen deklarativen Vertrag:

```ts
interface SettingsSubpageDef {
  id: SettingsSubpageId;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType;
  group: SettingsSubpageGroup;
  readAccess: SettingsAccessRule;
  writeAccess: SettingsAccessRule;
  sections: SettingsSectionLayoutDef[];
}
```

## 2.3 Zugriffstypen

```ts
interface SettingsAccessRule {
  roles?: AppRole[];
  permissions?: Permission[];
  mode?: 'any' | 'all';
}
```

Ziel:

- Rollen- und Permission-Regeln können kombiniert werden
- Leserechte und Schreibrechte sind explizit getrennt
- keine ad-hoc-Berechtigungslogik pro Komponente

## 2.4 Formularvertrag

```ts
interface SettingsFormAdapter<TView, TSubmit> {
  toFormValues(data: TView | null): Record<string, unknown>;
  toSubmitPayload(values: Record<string, unknown>): TSubmit;
}

interface SettingsPageDataHook<TView, TSubmit> {
  usePageData: () => {
    data: TView | null;
    isLoading: boolean;
    save: (payload: TSubmit) => Promise<void>;
    canWrite: boolean;
  };
}
```

Damit bleibt Business-Logik aus den Komponenten herausziehbar.

---

## 3. Gemeinsame Utilities

## 3.1 Form-Pattern

Jede Settings-Seite mit schreibbarer Konfiguration folgt demselben Pattern:

1. Daten laden über Service/Hook
2. ViewModel in Formwerte mappen
3. Dirty-State zentral bestimmen
4. `Save`, `Cancel`, optional `Reset to server state`
5. Schreibrechte zentral auswerten

## 3.2 Ziel-Utilities

### Bestehende Utilities, die beibehalten werden sollen

- `createDirtyStateSummary`
- `hasFormErrors`
- `mapNullableToEmptyString`

### Zu ergänzende Utilities

- `createSettingsFormState(form, initialData)`
- `resetSettingsForm(form, data)`
- `buildSettingsSubmitHandler({ form, save, onSuccess })`
- `createSettingsPageActions({ canWrite, isDirty, isPending })`

## 3.3 Ziel für gemeinsame UI-Bausteine

### `SettingsPageShell`

Verantwortlich für:

- Seitentitel
- Beschreibung
- Abschnitte
- Lade-/Fehlerzustand

### `SettingsFormActions`

Verantwortlich für:

- Dirty-State-Hinweis
- Speichern
- Abbrechen
- Disable-Logik

### `SettingsSectionCard`

Verantwortlich für:

- standardisierte Abschnittsdarstellung
- Gefahr-/Warn-Varianten

---

## 4. Berechtigungsmodell

## 4.1 Prinzipien

- jede Unterseite hat eigene Leseregeln
- jede Unterseite hat eigene Schreibregeln
- Access-Control wird zentral in `settings/access.ts` ausgewertet
- Komponenten erhalten nur `canRead`/`canWrite`, nie rohe Policy-Entscheidungen

## 4.2 Zielmatrix

### Rollen

- Lesen: `admin:all`
- Schreiben: `admin:all`

### Rollen & Rechte

- Lesen: `admin:all`
- Schreiben: `admin:all`

### Mein Profil

- Lesen: authentifizierter Nutzer
- Schreiben: authentifizierter Nutzer

### Vereinsdaten

- Lesen: `settings:read`
- Schreiben: `settings:write`

### Saisonverwaltung

- Lesen: `settings:read`
- Schreiben: `settings:write`

### Spiellokale

- Lesen: `settings:read`
- Schreiben: `settings:write`

### Darstellung

- Lesen: authentifizierter Nutzer
- Schreiben: authentifizierter Nutzer

### Benachrichtigungen

- Lesen: authentifizierter Nutzer
- Schreiben: authentifizierter Nutzer

### Datenschutz

- Lesen: authentifizierter Nutzer
- Schreiben: authentifizierter Nutzer

### Sicherheit

- Lesen: authentifizierter Nutzer
- Schreiben: authentifizierter Nutzer

### Backup

- Lesen: `admin:all`
- Schreiben: `admin:all`

### Gefahrenzone

- Lesen: `admin:all`
- Schreiben: `admin:all`

## 4.3 Technische Regel

Read und write werden immer getrennt geprüft. Eine sichtbare Seite ist deshalb nicht automatisch editierbar.

---

## 5. Keine Business-Logik in Settings-Komponenten

Settings-Komponenten dürfen:

- Form rendern
- UI-Zustand anzeigen
- zentrale Hooks und Services aufrufen

Settings-Komponenten dürfen nicht:

- direkte `supabase.from(...)`-Queries definieren
- Rechteentscheidungen lokal erfinden
- Feld-Mapping und Persistenzlogik mischen
- fachliche Seiteneffekte selbst orchestrieren

Stattdessen:

- `SettingsClub.tsx` nutzt einen `clubSettingsService` oder `useClubSettingsPage`
- `SettingsRoles.tsx` nutzt `settingsRoleService`
- `SettingsPermissions.tsx` nutzt `settingsPermissionService`
- `SettingsBackup.tsx` nutzt `backup/export service`

---

## 6. Refactoring-Reihenfolge

1. Unterseitenmodell auf finale Liste bringen: `permissions` ergänzen, `general` entfernen oder auslagern.
2. `subpages.ts`, `types.ts`, `permissions.ts`, `sectionLayouts.ts`, Label-Maps angleichen.
3. gemeinsame Shell- und Form-Actions-Komponenten einführen.
4. direkte Supabase-Zugriffe aus Settings-Komponenten domänenweise in Services verschieben.
5. Read-/Write-Access zentral in Navigation und Page-Render auswerten.

## 7. Beziehung zum Ist-Zustand

Diese Zielarchitektur baut auf bereits vorhandenen Bausteinen auf:

- `src/settings/types.ts`
- `src/settings/subpages.ts`
- `src/settings/access.ts`
- `src/settings/permissions.ts`
- `src/settings/sectionLayouts.ts`
- `src/settings/formUtils.ts`

Aktuell gut vorhanden sind bereits:

- zentrale Subpage-Registry
- zentrale Label-Map
- erste Abschnittsdefinitionen
- erste Dirty-State-Helfer

Noch inkonsistent sind derzeit:

- fehlende eigene Unterseite `Rollen & Rechte`
- direkte Business-Logik in mehreren Settings-Komponenten
- kein vollständig standardisiertes Save/Cancel/Dirty-State-Pattern
- Access-Control nur teilweise deklarativ modelliert

Für die fachliche Modellierung von `venues` und `club_settings` siehe zusätzlich:

- `docs/architecture/venue-club-domain-2026-04-07.md`
