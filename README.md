# TT Club Hub

## Projektüberblick

TT Club Hub ist eine Vereins- und Spielbetriebsanwendung für Tischtennis mit Fokus auf:

- Mitglieder- und Profildaten
- Mannschaften und Teamzuordnungen
- Saison-, Phasen- und Spielplanverwaltung
- Rollen, Berechtigungen und Admin-Workflows
- Kommunikation, Vorstand, Datenschutz und Export

## Dokumentations-Einstieg

Architektur- und Zielbild-Dokumente liegen unter `docs/architecture` und `docs/security`.

Wichtige Einstiege:

- `docs/architecture/service-layer-target-architecture-2026-04-02.md`
- `docs/architecture/settings-target-architecture-2026-04-07.md`
- `docs/architecture/technical-quality-framework-2026-04-07.md`
- `docs/architecture/ui-label-standardization-2026-04-07.md`
- `docs/architecture/mapping-target-architecture-2026-04-07.md`
- `docs/security/rls_target_architecture_2026-04-07.md`

## Aktuelle Zielbilder (2026-04-07)

- Technischer Qualitätsrahmen: verbindliche Qualitäts-, Test- und Architekturregeln
- UI-Label-Standardisierung: zentrale deutsche Label-Maps und Resolver
- Mapping-Zielarchitektur: `DB Row -> DomainModel -> ViewModel` für Kernmodule
- RLS-Zieldesign: deny-by-default für produktive Tabellen

## Hinweis

Die Dokumentation folgt einem datierten Muster. Neue Zielbilder werden als neue `.md`-Dokumente ergänzt und aus bestehenden Basisdokumenten verlinkt, statt ältere Fassungen stillschweigend zu überschreiben.
