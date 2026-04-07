# UI-Label-Standardisierung (2026-04-07)

## Zielbild
Alle UI-Labels, Statuswerte, Modulbezeichnungen und tab-/settingsbezogenen Anzeigen werden zentral, typsicher und deutschsprachig aufgelöst. Komponenten kennen keine fachlichen Label-Strings mehr direkt, sondern nur noch stabile Schlüssel.

---

## Gelieferte Bausteine

### Typen
- `AppModuleKey`
- `AppRole`
- `Permission`
- `SettingsSubpageId`
- `SettingsSubpageGroup`
- `ModuleKey`
- `PermissionLevel`
- `AgeGroup`
- `SeasonAudience`
- `PhaseType`
- `MatchStatus`
- `SubstituteStatus`
- `TrainingBookingStatus`
- `SettingsTabKey`

### Zentrale Label-Maps
- `MODULE_LABELS_DE`
- `ROLE_LABELS_DE`
- `PERMISSION_LABELS_DE`
- `PERMISSION_LEVEL_LABELS_DE`
- `PERMISSION_MODULE_LABELS_DE`
- `MATCH_STATUS_LABELS_DE`
- `SUBSTITUTE_STATUS_LABELS_DE`
- `TRAINING_BOOKING_STATUS_LABELS_DE`
- `STATUS_LABELS_DE`
- `NAV_GROUP_LABELS_DE`
- `SETTINGS_GROUP_LABELS_DE`
- `SETTINGS_SUBPAGE_LABELS_DE`
- `SETTINGS_TAB_LABELS_DE`
- `SEASON_AUDIENCE_LABELS_DE`
- `AGE_GROUP_LABELS_DE`
- `PHASE_TYPE_LABELS_DE`
- `GENDER_LABELS_DE`

### Resolver
- `getModuleLabel()`
- `getPermissionModuleLabel()`
- `getRoleLabel()`
- `getPermissionLabel()`
- `getPermissionLevelLabel()`
- `getStatusLabel()`
- `getMatchStatusLabel()`
- `getSubstituteStatusLabel()`
- `getTrainingBookingStatusLabel()`
- `getNavGroupLabel()`
- `getSettingsGroupLabel()`
- `getSettingsSubpageLabel()`
- `getSettingsTabLabel()`
- `getSeasonAudienceLabel()`
- `getAgeGroupLabel()`
- `getPhaseTypeLabel()`
- `getGenderLabel()`

---

## Fachliche Begriffsnorm

### Saison- und Zielgruppenbegriffe
- `erwachsene` -> `Erwachsene`
- `jugend` -> `Jugend`
- `first_half` -> `Vorrunde`
- `second_half` -> `Rückrunde`
- `single_half` -> `Halbrunde`

### Regeln
- Altersgruppen werden als zentrale Fachbegriffe geführt, nicht komponentenlokal.
- Phase- und Zielgruppenbegriffe werden für Import, Saisons, Teamzuordnung und Profil einheitlich verwendet.
- Modulbezeichnungen unterscheiden zwischen App-Modulen (`matches`, `settings`, `roles`) und Berechtigungsmatrix-Modulen (`teams`, `board`, `import`), aber beide laufen über dieselbe zentrale Label-Domain.

---

## Fallback-Strategie

Alle Resolver unterstützen unbekannte Schlüssel und liefern definierte deutsche Fallbacks statt nackter Rohwerte. Beispiele:

- `Unbekanntes Modul (foo)`
- `Unbekannte Rolle (foo)`
- `Unbekannter Spielstatus (foo)`
- `Unbekannte Settings-Seite (foo)`

Ziel dieser Strategie:
- UI bleibt lesbar, auch wenn Backend oder Datenbestand neue Schlüssel liefern.
- Debugging bleibt möglich, weil der Original-Key sichtbar bleibt.
- Komponenten müssen keine eigene Fallback-Logik mehr implementieren.

---

## Bereits umgestellte Bereiche

- Navigation und Settings-Navigation
- Rollen- und Permission-Labels
- Season- und Phasenlabels in `Seasons` und `SettingsSeasons`
- Match-, Ersatz- und Trainingsstatus in `TeamSchedule`, `Substitutes`, `Training`, `Admin`
- Altersgruppen in `Members`, `SettingsProfile`, `TeamEditDialog`
- Rollenlabels in `profileInfoService`

---

## Betroffene Domänen

1. Navigation und Routing
2. Auth, Rollen und Berechtigungen
3. Settings und Settings-Unterseiten
4. Saison-, Zyklus- und Phasenverwaltung
5. Mitglieder- und Profildaten
6. Mannschaften und Teamzuordnungen
7. Spielplan und Ergebnisse
8. Ersatzstellung
9. Training
10. Administration
11. Import
12. Kommunikation und Vorstand
13. Export- und Berichtsausgaben

---

## Refactoring-Plan

### Phase 1 - Infrastruktur absichern
1. Alle neuen UI-Labels nur noch in `src/constants/uiLabels.ts` anlegen.
2. Für neue fachliche Schlüssel zuerst Typ ergänzen, dann Map, dann Resolver.
3. Doppelte Label-Dateien schrittweise auf zentrale Exporte reduzieren.

### Phase 2 - Lokale Label-Konstanten abbauen
1. Komponenten mit `const ...LABELS` sukzessive auf zentrale Resolver migrieren.
2. Besonders priorisieren:
   - `Board.tsx`
   - `Communication.tsx`
   - `Import.tsx`
   - weitere Admin-/Profile-/Export-Komponenten
3. Harte Regel: keine neuen Status-/Rollen-/Modulstrings mehr direkt in Pages.

### Phase 3 - Fachliche Schlüssel konsolidieren
1. Uneinheitliche Werte wie `Jungen 18` vs `Jungen U18` fachlich entscheiden und repo-weit vereinheitlichen.
2. Query-Filter, Exporttitel und Badge-Texte auf dieselbe Begriffsnorm umstellen.
3. Backend-nahe Enums und ViewModels gegen dieselbe Label-Domain dokumentieren.

### Phase 4 - Governance
1. ESLint-Regel oder Review-Check für lokale `...LABELS`-Maps in Pages einführen.
2. Architekturregel dokumentieren: UI rendert Labels nur über Resolver oder zentral importierte Maps.
3. Tests für Resolver-Fallbacks und kritische Fachschlüssel ergänzen.

---

## Offene Restarbeiten

- `Board.tsx`: lokale Rollen- und Kanaltyp-Labels
- `Communication.tsx`: lokale Kategorien- und Typ-Labels
- `Import.tsx`: Step-Labels für Wizard-Tabs
- mögliche Export-/Reporting-Titel mit doppelt gepflegten Begriffen
- Bereinigung historischer Routen-/Tab-Altwerte wie `general`