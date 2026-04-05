## IAM Bundle

Consolidated identity and access management bundle. Combines authentication (sign-up, sign-in, JWT lifecycle), role-based access control (roles, permissions, user-role assignments), user profiles (display settings, preferences, search history), and teams (team CRUD, membership management).

### Responsibilities
- User authentication and session management (JWT + refresh tokens)
- Role and permission management with scoped assignments
- User profile and preference storage
- Team creation, membership, and role assignment within teams

### Tables
users, refresh_tokens, revoked_tokens, roles, user_roles, profiles, search_history, teams, team_members

### Key interfaces
getUser, validateToken, revokeUserSessions, hasRole, getUserRoles, hasPermission, getProfile, getUserPreferences

## License

MIT — see [LICENSE](./LICENSE)
