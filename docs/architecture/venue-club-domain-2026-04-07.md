# Venue- und Vereinsdaten-Domain – 2026-04-07

## Zielbild

`venues` und `club_settings` werden als gemeinsame, aber klar getrennte Konfigurationsdomäne für Vereinsstammdaten und Spiellokale modelliert.

Die Domain hat zwei Kernaggregate:

- **Venue**
  Spiellokal als operative Ressource für Spielplan und Druck/Export.
- **ClubProfile**
  Vereinsstammdaten mit Trennung zwischen öffentlicher Außendarstellung und internen Verwaltungsdaten.

Leitregeln:

- **Spiellokale sind operative Infrastruktur.**
- **Vereinsdaten sind ein Singleton-Profil mit public/internal Split.**
- **Öffentliche und interne Vereinsdaten werden nie aus derselben Sicht ungefiltert ausgeliefert.**

---

## 1. Datenmodell

## 1.1 Venue-Aggregat

### Zweck

`Venue` beschreibt einen nutzbaren Spielort für Heim- und Auswärtsspiele, Druckausgaben und Info-Anzeigen.

### Ziel-Felder

```ts
interface VenueModel {
  id: string;
  name: string;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  addressLine: string | null;
  additionalInfo: string | null;
  isActive: boolean;
  isDefaultVenue: boolean;
  isHomeVenue: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Abbildung auf den aktuellen Tabellenstand

Bestehende DB-Felder:

- `name`
- `street`
- `zip_code`
- `city`
- `notes`
- `is_home_venue`

Empfohlene fachliche Weiterentwicklung:

- `notes` fachlich als `additionalInfo` behandeln
- neues Feld `is_active boolean not null default true`
- neues Feld `is_default_venue boolean not null default false`

### Invarianten

- `name` ist Pflichtfeld.
- `is_default_venue` darf nur für aktive Venues gesetzt werden.
- Es darf höchstens ein Default-Venue pro Club geben.
- Ein inaktives Venue darf nicht als Standard-Venue gelten.
- Ein Venue darf inaktiv sein, obwohl es historisch noch in Matches referenziert wird.

## 1.2 ClubProfile-Aggregat

`club_settings` bleibt technisch ein Singleton, wird fachlich aber in zwei Sichten modelliert:

- `ClubPublicProfile`
- `ClubInternalProfile`

### Public-Sicht

```ts
interface ClubPublicProfile {
  clubName: string;
  shortName: string | null;
  association: string | null;
  website: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  logoRef: string | null;
  publicInfo: string | null;
  address: {
    street: string | null;
    zipCode: string | null;
    city: string | null;
  };
}
```

### Internal-Sicht

```ts
interface ClubInternalProfile {
  id: string;
  clubName: string;
  clubNumber: string | null;
  shortName: string | null;
  association: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  supportEmail: string | null;
  website: string | null;
  logoRef: string | null;
  primaryColor: string | null;
  publicInfo: string | null;
  internalInfo: string | null;
  address: {
    street: string | null;
    zipCode: string | null;
    city: string | null;
  };
  createdAt: string;
  updatedAt: string;
}
```

### Abbildung auf den aktuellen Tabellenstand

Bestehend:

- `club_name`
- `club_number`
- `association`
- `logo_url`
- `primary_color`
- `contact_email`
- `contact_phone`
- `website`
- `street`
- `zip_code`
- `city`

Empfohlene Ergänzungen:

- `short_name text null`
- `support_email text null`
- `public_info text null`
- `internal_info text null`
- `logo_ref text null` als fachlicher Zielname für Dateireferenz; `logo_url` kann übergangsweise als technisches Legacy-Feld gemappt werden

### Invarianten

- `club_settings` bleibt Singleton.
- `club_name` ist Pflichtfeld.
- `support_email` ist intern-administrativ und niemals automatisch Teil der Public-Sicht.
- `public_info` darf in Info-Seite, Druck und Public-Exports erscheinen.
- `internal_info` darf nur in Admin-/Settings-Kontexten erscheinen.

---

## 2. Service-API

## 2.1 Zielstruktur

```text
src/
  services/
    venue/
      venue.types.ts
      venue.mapper.ts
      venue.service.ts
    club-profile/
      club-profile.types.ts
      club-profile.mapper.ts
      club-profile.service.ts
```

Fassaden können übergangsweise weiter unter `settings` oder `profileInfoService` delegieren.

## 2.2 Venue-Service

```ts
interface VenueFilterInput {
  isActive?: boolean;
  onlyDefault?: boolean;
  onlyHome?: boolean;
  search?: string;
}

interface VenueService {
  list(query?: ListQuery<VenueFilterInput, 'name' | 'city' | 'updatedAt'>): Promise<ApiResult<PaginatedData<VenueViewModel>>>;
  listActive(): Promise<ApiResult<VenueViewModel[]>>;
  listSelectableForSchedule(): Promise<ApiResult<VenueViewModel[]>>;
  getById(id: string): Promise<ApiResult<VenueViewModel | null>>;
  getDefaultVenue(): Promise<ApiResult<VenueViewModel | null>>;
  create(input: VenueCreateInput): Promise<ApiResult<VenueViewModel>>;
  update(id: string, input: VenueUpdateInput): Promise<ApiResult<VenueViewModel>>;
  setDefault(id: string): Promise<ApiResult<VenueViewModel>>;
  deactivate(id: string): Promise<ApiResult<VenueViewModel>>;
  remove(id: string): Promise<ApiResult<void>>;
}
```

### Service-Regeln

- `listSelectableForSchedule()` liefert nur aktive Venues.
- `getDefaultVenue()` liefert nur ein aktives Standard-Venue.
- `setDefault(id)` muss alle anderen `is_default_venue` zurücksetzen.
- `remove(id)` ist nur erlaubt, wenn keine aktive fachliche Referenzstrategie verletzt wird, sonst Soft-Deactivate bevorzugen.

## 2.3 ClubProfile-Service

```ts
interface ClubProfileService {
  getPublicProfile(): Promise<ApiResult<ClubPublicProfileViewModel | null>>;
  getInternalProfile(): Promise<ApiResult<ClubInternalProfileViewModel | null>>;
  updateInternalProfile(input: ClubProfileUpdateInput): Promise<ApiResult<ClubInternalProfileViewModel>>;
  updateBranding(input: ClubBrandingUpdateInput): Promise<ApiResult<ClubInternalProfileViewModel>>;
}
```

### Service-Regeln

- `getPublicProfile()` liest aus einer Public-View oder einem expliziten Public-Mapper, nicht direkt aus dem internen Record.
- `getInternalProfile()` ist nur für Settings/Admin-Kontexte zulässig.
- `updateInternalProfile()` akzeptiert sowohl öffentliche als auch interne Felder, rendert aber nie ungefilterte interne Daten an Public-Consumer zurück.

## 2.4 Verwendung durch andere Module

### Spielplan

- `scheduleService` konsumiert `venueService.listSelectableForSchedule()`
- `scheduleService` kann optional `venueService.getDefaultVenue()` für Heimspiel-Vorbelegung nutzen

### Info-Seite

- `profileInfoService` oder Nachfolger nutzt ausschließlich `clubProfileService.getPublicProfile()`

### Einstellungen

- `SettingsClub` nutzt ausschließlich `clubProfileService.getInternalProfile()` und `updateInternalProfile()`
- `SettingsVenues` nutzt ausschließlich `venueService`

### Druck/Export

- operative Druck- und Exportbuilder nutzen `ClubPublicProfile`
- Admin-Drucke/Exporte nutzen je nach Policy `ClubInternalProfile`

---

## 3. Sichtbarkeitsregeln

## 3.1 Venue-Sichtbarkeit

### Für authentifizierte Nutzer lesbar

- `name`
- `street`
- `zipCode`
- `city`
- `additionalInfo`, sofern es nur ortsbezogene Hinweise enthält
- `isHomeVenue`
- `isActive`, falls für operative Auswahl notwendig

### Für Spielplan-/öffentliche Darstellung

- nur aktive Venues anzeigen
- inaktive Venues nur für historische Matchansichten oder Admin-Kontexte rendern

### Schreibzugriff

- `admin` und `vorstand`

## 3.2 ClubProfile-Sichtbarkeit

### Public-Sicht

Erlaubt für Info-Seite, Druck und operative Exporte:

- `clubName`
- `shortName`
- `association`
- `website`
- `publicEmail` oder freigegebenes `contactEmail`
- `publicPhone` oder freigegebenes `contactPhone`
- `logoRef`
- `publicInfo`
- öffentliche Anschrift

### Internal-Sicht

Nur für `admin`, `vorstand`, ggf. spezifische Settings-Services:

- `clubNumber`
- `contactEmail`
- `contactPhone`
- `supportEmail`
- `internalInfo`
- Branding-Felder wie `primaryColor`, technische Logo-Referenzdetails

## 3.3 Keine Vermischung von Public und Internal

Technische Regel:

- kein UI- oder Export-Consumer liest direkt aus `club_settings`, wenn nur öffentliche Daten gebraucht werden
- stattdessen getrennte Read-Modelle:
  - `club_public_info` oder `ClubPublicProfileViewModel`
  - `ClubInternalProfileViewModel`

## 3.4 Empfohlene RLS-/View-Strategie

- `club_settings` bleibt intern für `admin`, `vorstand`, `developer`
- `club_public_info` bleibt das öffentliche Lesemodell
- optional neue View `venue_public_info`, wenn zukünftig interne Venue-Zusatzfelder hinzukommen

---

## 4. Verwendungsorte

## 4.1 Spielplan

- Venue-Auswahl in Match-Dialogen
- Anzeige von Heimspielorten in Team-/Spielplanansichten
- Fallback auf Standard-Venue für Heimspiele

## 4.2 Info-Seite

- ClubName
- Verbands-/Vereinsnummer nur, wenn public freigegeben
- Kontakt und Webadresse
- öffentliche Kurzbeschreibung (`publicInfo`)
- Logo-Referenz

## 4.3 Einstellungen

- vollständige interne Pflege von `club_settings`
- vollständige Pflege von Venues inklusive Aktivstatus und Standardkennzeichen

## 4.4 Druck / Export

- Drucke wie Spieltagsblatt, Heimspielplan, Ranglistenbriefkopf nutzen Public ClubProfile
- Admin-Exporte dürfen interne Vereinsdaten nur rollenabhängig nutzen
- Venue-Druckausgaben verwenden aktive Venues oder historisch referenzierte Venues je Kontext

---

## 5. Edge Cases

## 5.1 Venues

- Es gibt kein aktives Default-Venue.
  Regel: zulässig, aber Heimspiel-Dialoge dürfen keinen stillen Default annehmen.
- Mehrere Venues sind als Standard markiert.
  Regel: Service muss dies beim Schreiben verhindern oder bereinigen.
- Ein Venue wird inaktiv gesetzt, obwohl künftige Matches es referenzieren.
  Regel: zulässig mit Warnung oder blockierend je Policy; historisch referenzierte Matches bleiben lesbar.
- Venue wird gelöscht, obwohl Matches darauf verweisen.
  Regel: `ON DELETE SET NULL` ist technisch möglich, fachlich aber nur nach expliziter Bestätigung oder besser Soft-Deactivate.
- `additionalInfo` enthält interne Hinweise wie Zugangscode oder Hallenschlüssel.
  Regel: dann muss das Feld in Public-/operativen Sichten getrennt werden; keine unstrukturierte Mischnutzung.

## 5.2 ClubProfile

- `club_settings` fehlt trotz Singleton-Annahme.
  Regel: Service liefert `null` und Settings-Seite erlaubt Erstinitialisierung.
- `club_settings` enthält Legacy-Feld `logo_url`, aber künftig wird `logo_ref` genutzt.
  Regel: Mapper kapselt Übergang und verhindert UI-Leakage von Storage-Details.
- `supportEmail` und `contactEmail` sind identisch.
  Regel: zulässig, aber fachlich getrennt behandeln.
- `publicInfo` ist leer, interne Infos sind gepflegt.
  Regel: Info-Seite zeigt keine internen Inhalte als Fallback.
- `contactEmail` ist intern, aber Public-View zeigt aktuell dieselbe Adresse.
  Regel: explizites Public-Feld oder klare Freigabepolicy nötig; keine implizite Wiederverwendung.

## 5.3 Modulgrenzen

- `profileInfoService.getPublicClubInfo()` liest aktuell noch direkt aus `club_settings` statt aus einer Public-Domain-Sicht.
  Regel: auf `clubProfileService.getPublicProfile()` migrieren.
- `TeamSchedule.tsx` liest Venues direkt per Supabase.
  Regel: auf `venueService.listActive()` oder `listSelectableForSchedule()` migrieren.
- `SettingsClub.tsx` und `SettingsVenues.tsx` enthalten aktuell Business-Logik.
  Regel: in dedizierte Domain-Services verschieben.

---

## 6. Konkrete Empfehlungen

1. `venues` um `is_active` und `is_default_venue` ergänzen.
2. `club_settings` fachlich in Public/Internal-Profil trennen und zusätzliche Felder `support_email`, `public_info`, `internal_info`, `short_name`, `logo_ref` einführen.
3. `profileInfoService.getPublicClubInfo()` auf eine echte Public-Domain-Sicht umstellen.
4. `SettingsClub` und `SettingsVenues` auf `clubProfileService` und `venueService` migrieren.
5. Export-/Drucklogik ausschließlich gegen ViewModels und nie direkt gegen rohe Tabellen koppeln.

## 7. Beziehung zum Ist-Zustand

Diese Domain reagiert direkt auf den aktuellen Stand:

- `venues` existiert bereits, ist aber fachlich zu schmal modelliert.
- `club_settings` existiert bereits als Singleton mit internem RLS und Public-View-Ansatz.
- Die UI verwendet beide Tabellen noch direkt in Settings und teilweise im Spielplan.
- Die Trennung zwischen öffentlichen und internen Vereinsdaten ist begonnen, aber im Service-Layer noch nicht konsequent durchgezogen.
