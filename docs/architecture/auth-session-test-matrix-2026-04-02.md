# Auth & Session Testmatrix (2026-04-02)

| Fall | Session | Member-Profil | user_roles | Erwartung Resolver | Erwartung Guard |
|---|---|---|---|---|---|
| 1. Keine Session | ❌ | - | - | `NO_SESSION`, `isAuthenticated=false` | Redirect zu `/auth` |
| 2. Session + valides Member + valide Rollen | ✅ | ✅ | ✅ | Keine Problems, `isAuthenticated=true` | Zugriff erlaubt bei passender Rolle |
| 3. Session ohne Member-Profil | ✅ | ❌ | ✅ | `MISSING_MEMBER` | Redirect zu `/auth`, `MissingMemberProfileError` bei Component-Guard |
| 4. Session ohne user_roles | ✅ | ✅ | ❌ | `NO_USER_ROLES` | Redirect zu `/auth`, `MissingUserRolesError` bei Component-Guard |
| 5. Session mit ungültigen Rollenwerten | ✅ | ✅ | ⚠️ | `INVALID_ROLE` | Redirect zu `/auth` |
| 6. Session mit fremden user_roles Datensätzen | ✅ | ✅/❌ | ⚠️ | `INCONSISTENT_DATA` | Redirect zu `/auth` |
| 7. Session mit fremdem Member `user_id` | ✅ | ⚠️ | ✅ | `INCONSISTENT_DATA` | Redirect zu `/auth` |
| 8. Auth ok, Rolle nicht erlaubt | ✅ | ✅ | ✅ | `isAuthenticated=true` | `ROLE_DENIED`, Redirect zu Fallback |
| 9. Multi-Role User (`trainer` + `spieler`) | ✅ | ✅ | ✅ | `roles` dedupliziert, `primaryRole=trainer` | `hasAnyRole` erlaubt `trainer`-Routen |
| 10. Vorstand/Admin Shortcut | ✅ | ✅ | ✅ | - | `isAdminOrBoard=true` für `admin`/`vorstand` |

## Abdeckung in automatisierten Tests

- Resolver-Fälle: 1, 3, 4, 6, 9.
- Guard-Fälle: 8, 9, 10.
- Fehlerklassen über `assertAuthorized`: 3, 4.
