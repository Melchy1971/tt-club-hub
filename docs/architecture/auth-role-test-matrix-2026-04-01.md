# Auth- & Rollen-Testmatrix (2026-04-01)

| Bereich | Fall | Erwartung |
| --- | --- | --- |
| Session-Resolver | Keine Session | `NO_SESSION`, `isAuthenticated=false` |
| Session-Resolver | Session ohne Member | `MISSING_MEMBER`, `isAuthenticated=false` |
| Session-Resolver | Session ohne Rollen | `NO_USER_ROLES`, `isAuthenticated=false` |
| Session-Resolver | Session mit ungültigen Rollenwerten | `INVALID_ROLE`, `isAuthenticated=false` |
| Session-Resolver | Inkonsistente `user_roles` oder `member.user_id` | `INCONSISTENT_DATA`, `isAuthenticated=false` |
| Session-Resolver | Valide Session + Member + Rollen | `problems=[]`, `isAuthenticated=true`, Primärrolle aufgelöst |
| Route-Guard | Nicht authentifiziert | Zugriff verweigert mit Auth-Reason |
| Route-Guard | Authentifiziert, Rolle fehlt | Zugriff verweigert mit `ROLE_DENIED` |
| Route-Guard | Authentifiziert, Rolle vorhanden | Zugriff erlaubt |
| Komponenten-Guard | `hasRole` mit Einzelrolle | `true/false` korrekt |
| Komponenten-Guard | `hasRole` mit Rollenliste | `true/false` korrekt |
| Komponenten-Guard | `canRead/canWrite` pro Domain | Domain-spezifische Berechtigung korrekt |
