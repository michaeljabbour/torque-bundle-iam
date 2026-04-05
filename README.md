# @torquedev/bundle-iam

Identity, admin, profile, and teams -- consolidated IAM bundle.

## What It Provides

- **Authentication** -- sign-up, sign-in, JWT access/refresh token lifecycle, session revocation
- **Role-Based Access Control** -- roles, permissions, scoped user-role assignments
- **User Profiles** -- display name, bio, avatar, timezone, theme, notification preferences
- **Search History** -- per-user search query tracking
- **Teams** -- team CRUD, membership management with per-team roles
- **Admin Dashboard** -- user listing, role management, platform stats
- **UI Pages** -- login, admin dashboard, role manager, user manager, profile, settings, teams

### API Routes

| Area | Endpoints |
|------|-----------|
| Identity | `POST /api/identity/sign_up`, `sign_in`, `refresh`; `GET /api/identity/me` |
| Admin | CRUD on `/api/admin/roles`, `/api/admin/users`, user role assignment, `/api/admin/stats` |
| Profile | `GET/PATCH /api/profile`, `/api/profile/settings`, `/api/profile/search-history` |
| Teams | CRUD on `/api/teams`, member management on `/api/teams/:teamId/members` |

### Cross-Bundle Interfaces

`getUser`, `validateToken`, `revokeUserSessions`, `hasRole`, `getUserRoles`, `hasPermission`, `getProfile`, `getUserPreferences`

## Installation

```
npm install @torquedev/bundle-iam
```

Or as a git dependency in your mount plan:

```yaml
source: "git+https://github.com/torque-framework/torque-bundle-iam.git@main"
```

## Usage

Add to your mount plan. No hard dependencies -- optionally integrates with `kanban-app` and `kanban` bundles.

## License

MIT -- see [LICENSE](./LICENSE)
