import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

export default class IAM {
  constructor({ data, events, config, coordinator }) {
    this.data = data;
    this.events = events;
    this.config = config;
    this.coordinator = coordinator;

    // Identity config
    const secret = config.config?.jwt_secret;
    if (!secret) {
      throw new Error(
        '[iam] jwt_secret is required. Set AUTH_SECRET in your environment.'
      );
    }
    if (secret === 'change-me' && process.env.NODE_ENV === 'production') {
      throw new Error(
        '[iam] jwt_secret must not be "change-me" in production. ' +
        'Set AUTH_SECRET to a strong random value.'
      );
    }
    if (secret === 'change-me') {
      console.warn('[iam] WARNING: using default jwt_secret "change-me". Set AUTH_SECRET to a strong value before deploying.');
    }
    this.jwtSecret = secret;
    this.jwtTtl = config.config?.jwt_ttl_seconds || 3600;
    this.refreshTtl = config.config?.refresh_ttl_seconds || 86400;
    this.maxSessions = config.config?.max_sessions || 10;

    // Admin: seed default roles
    this._seedDefaultRoles();
  }

  intents() {
    return {};
  }

  interfaces() {
    return {
      // Identity interfaces
      getUser: ({ userId }) => this.getUser(userId),
      validateToken: ({ token }) => this.validateToken(token),
      revokeUserSessions: ({ userId }) => this.revokeUserSessions(userId),

      // Admin interfaces
      hasRole: ({ userId, roleName, scopeType, scopeId }) => {
        const roles = this.data.query('roles', { name: roleName });
        if (roles.length === 0) return { hasRole: 0 };
        const filters = { user_id: userId, role_id: roles[0].id };
        if (scopeType) filters.scope_type = scopeType;
        if (scopeId) filters.scope_id = scopeId;
        const assignments = this.data.query('user_roles', filters);
        return { hasRole: assignments.length > 0 ? 1 : 0 };
      },

      getUserRoles: ({ userId }) => {
        const assignments = this.data.query('user_roles', { user_id: userId });
        return assignments.map((a) => {
          const role = this.data.find('roles', a.role_id);
          return {
            role_name: role ? role.name : 'unknown',
            scope_type: a.scope_type || null,
            scope_id: a.scope_id || null,
          };
        });
      },

      hasPermission: ({ userId, permission }) => {
        const assignments = this.data.query('user_roles', { user_id: userId });
        for (const a of assignments) {
          const role = this.data.find('roles', a.role_id);
          if (!role || !role.permissions) continue;
          try {
            const perms = JSON.parse(role.permissions);
            if (perms.includes('*') || perms.includes(permission)) {
              return { allowed: 1 };
            }
          } catch (e) {
            // skip malformed permissions
          }
        }
        return { allowed: 0 };
      },

      // Profile interfaces
      getProfile: ({ userId }) => {
        const rows = this.data.query('profiles', { user_id: userId });
        if (rows.length === 0) return null;
        const p = rows[0];
        return {
          user_id: p.user_id,
          display_name: p.display_name,
          bio: p.bio,
          avatar_url: p.avatar_url,
          timezone: p.timezone,
        };
      },
      getUserPreferences: ({ userId }) => {
        const rows = this.data.query('profiles', { user_id: userId });
        if (rows.length === 0) {
          return { theme: 'dark', notification_email: true, notification_mentions: true };
        }
        const p = rows[0];
        return {
          theme: p.theme,
          notification_email: !!p.notification_email,
          notification_mentions: !!p.notification_mentions,
        };
      },
    };
  }

  routes() {
    return {
      // ── Identity routes
      signUp: (ctx) => {
        const result = this.signUp(ctx.body);
        return result.error ? { status: 422, data: result } : { status: 201, data: result };
      },
      signIn: (ctx) => {
        const result = this.signIn(ctx.body);
        return result.error ? { status: 401, data: result } : { status: 200, data: result };
      },
      refreshToken: (ctx) => {
        const result = this.refreshToken(ctx.body.refresh_token);
        return result.error ? { status: 401, data: result } : { status: 200, data: result };
      },
      me: (ctx) => {
        return { status: 200, data: ctx.currentUser };
      },

      // ── Admin routes
      listRoles: (ctx) => {
        const roles = this.data.query('roles', {});
        return { status: 200, data: roles };
      },

      createRole: (ctx) => {
        const { name, description, permissions } = ctx.body;
        if (!name) return { status: 400, data: { error: 'name is required' } };
        const existing = this.data.query('roles', { name });
        if (existing.length > 0) return { status: 409, data: { error: 'Role already exists' } };
        const role = this.data.insert('roles', {
          name,
          description: description || '',
          permissions: permissions || '[]',
        });
        return { status: 201, data: role };
      },

      updateRole: (ctx) => {
        const role = this.data.find('roles', ctx.params.roleId);
        if (!role) return { status: 404, data: { error: 'Role not found' } };
        const updated = this.data.update('roles', role.id, ctx.body);
        return { status: 200, data: updated };
      },

      deleteRole: (ctx) => {
        const role = this.data.find('roles', ctx.params.roleId);
        if (!role) return { status: 404, data: { error: 'Role not found' } };
        this.data.delete('roles', role.id);
        return { status: 200, data: { deleted: 1 } };
      },

      listUsers: async (ctx) => {
        const assignments = this.data.query('user_roles', {});
        const userMap = {};
        for (const a of assignments) {
          if (!userMap[a.user_id]) {
            userMap[a.user_id] = { user_id: a.user_id, roles: [] };
          }
          const role = this.data.find('roles', a.role_id);
          userMap[a.user_id].roles.push(role ? role.name : 'unknown');
          // Enrich with user details from local users table
          const user = this.getUser(a.user_id);
          if (user) {
            userMap[a.user_id].email = user.email;
            userMap[a.user_id].name = user.name;
          }
        }
        return { status: 200, data: Object.values(userMap) };
      },

      getUserRolesRoute: (ctx) => {
        const userId = ctx.params.userId;
        const assignments = this.data.query('user_roles', { user_id: userId });
        const result = assignments.map((a) => {
          const role = this.data.find('roles', a.role_id);
          return {
            id: a.id,
            role_id: a.role_id,
            role_name: role ? role.name : 'unknown',
            scope_type: a.scope_type || null,
            scope_id: a.scope_id || null,
          };
        });
        return { status: 200, data: result };
      },

      assignRole: (ctx) => {
        const userId = ctx.params.userId;
        const { role_id, scope_type, scope_id } = ctx.body;
        if (!role_id) return { status: 400, data: { error: 'role_id is required' } };
        const role = this.data.find('roles', role_id);
        if (!role) return { status: 404, data: { error: 'Role not found' } };

        const assignment = this.data.insert('user_roles', {
          user_id: userId,
          role_id,
          scope_type: scope_type || null,
          scope_id: scope_id || null,
        });

        this.events.publish('iam.role.assigned', {
          user_id: userId,
          role_id,
          scope_type: scope_type || null,
          scope_id: scope_id || null,
        }, { publisher: 'iam' });

        return { status: 201, data: assignment };
      },

      revokeRole: (ctx) => {
        const userId = ctx.params.userId;
        let roleId = ctx.params.roleId;
        // Support revoking by role name or role ID
        let assignments = this.data.query('user_roles', { user_id: userId, role_id: roleId });
        if (assignments.length === 0) {
          const roleByName = this.data.query('roles', { name: roleId });
          if (roleByName.length > 0) {
            roleId = roleByName[0].id;
            assignments = this.data.query('user_roles', { user_id: userId, role_id: roleId });
          }
        }
        if (assignments.length === 0) {
          return { status: 404, data: { error: 'Assignment not found' } };
        }
        for (const a of assignments) {
          this.data.delete('user_roles', a.id);
        }

        this.events.publish('iam.role.revoked', {
          user_id: userId,
          role_id: roleId,
        }, { publisher: 'iam' });

        return { status: 200, data: { revoked: 1 } };
      },

      getStats: async (ctx) => {
        const roles = this.data.query('roles', {});
        const assignments = this.data.query('user_roles', {});
        const uniqueUsers = new Set(assignments.map((a) => a.user_id));

        let totalWorkspaces = 0;
        try {
          const workspaces = await this.coordinator.call('kanban-app', 'listUserWorkspaces', {
            userId: ctx.currentUser.id,
          });
          totalWorkspaces = Array.isArray(workspaces) ? workspaces.length : 0;
        } catch (e) {
          // kanban-app bundle may not be available
        }

        return {
          status: 200,
          data: {
            total_roles: roles.length,
            total_user_assignments: assignments.length,
            total_users: uniqueUsers.size,
            total_workspaces: totalWorkspaces,
          },
        };
      },

      // ── Profile routes
      getMyProfile: (ctx) => {
        const profile = this._findOrCreateProfile(ctx.currentUser.id);
        return { status: 200, data: profile };
      },

      updateProfile: (ctx) => {
        const profile = this._findOrCreateProfile(ctx.currentUser.id);
        const allowed = ['display_name', 'bio', 'avatar_url', 'timezone'];
        const changes = {};
        for (const key of allowed) {
          if (ctx.body[key] !== undefined) {
            changes[key] = ctx.body[key];
          }
        }
        if (Object.keys(changes).length === 0) {
          return { status: 400, data: { error: 'No valid fields to update' } };
        }
        const updated = this.data.update('profiles', profile.id, changes);
        this.events.publish('iam.profile.updated', {
          user_id: ctx.currentUser.id,
          changes,
        }, { publisher: 'iam' });
        return { status: 200, data: updated };
      },

      getProfileByUserId: (ctx) => {
        const rows = this.data.query('profiles', { user_id: ctx.params.userId });
        if (rows.length === 0) {
          return { status: 404, data: { error: 'Profile not found' } };
        }
        const p = rows[0];
        return {
          status: 200,
          data: {
            user_id: p.user_id,
            display_name: p.display_name,
            bio: p.bio,
            avatar_url: p.avatar_url,
            timezone: p.timezone,
          },
        };
      },

      getSettings: (ctx) => {
        const profile = this._findOrCreateProfile(ctx.currentUser.id);
        return {
          status: 200,
          data: {
            theme: profile.theme,
            notification_email: !!profile.notification_email,
            notification_mentions: !!profile.notification_mentions,
            notification_due_dates: !!profile.notification_due_dates,
          },
        };
      },

      updateSettings: (ctx) => {
        const profile = this._findOrCreateProfile(ctx.currentUser.id);
        const allowed = ['theme', 'notification_email', 'notification_mentions', 'notification_due_dates'];
        const changes = {};
        for (const key of allowed) {
          if (ctx.body[key] !== undefined) {
            if (key.startsWith('notification_')) {
              changes[key] = ctx.body[key] ? 1 : 0;
            } else {
              changes[key] = ctx.body[key];
            }
          }
        }
        if (Object.keys(changes).length === 0) {
          return { status: 400, data: { error: 'No valid fields to update' } };
        }
        const updated = this.data.update('profiles', profile.id, changes);
        this.events.publish('iam.profile.updated', {
          user_id: ctx.currentUser.id,
          changes,
        }, { publisher: 'iam' });
        return { status: 200, data: updated };
      },

      getSearchHistory: (ctx) => {
        const history = this.data.query(
          'search_history',
          { user_id: ctx.currentUser.id },
          { order: 'created_at DESC', limit: 20 }
        );
        return { status: 200, data: history };
      },

      saveSearch: (ctx) => {
        const { query, results_count } = ctx.body;
        if (!query) {
          return { status: 400, data: { error: 'query is required' } };
        }
        const entry = this.data.insert('search_history', {
          user_id: ctx.currentUser.id,
          query,
          results_count: results_count || 0,
        });
        return { status: 201, data: entry };
      },

      // ── Teams routes
      listTeams: (ctx) => {
        const teams = this.data.query('teams', {});
        return { status: 200, data: teams };
      },

      createTeam: (ctx) => {
        const { name, description } = ctx.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return { status: 400, data: { error: 'name is required' } };
        }
        const team = this.data.insert('teams', {
          name: name.trim(),
          description: description || '',
        });

        // Auto-add the creator as owner
        this.data.insert('team_members', {
          team_id: team.id,
          user_id: ctx.currentUser.id,
          role: 'owner',
        });

        this.events.publish('iam.team.created', {
          team_id: team.id,
          name: team.name,
        }, { publisher: 'iam' });

        return { status: 201, data: team };
      },

      updateTeam: (ctx) => {
        const team = this.data.find('teams', ctx.params.teamId);
        if (!team) return { status: 404, data: { error: 'Team not found' } };

        const allowed = ['name', 'description'];
        const changes = {};
        for (const key of allowed) {
          if (ctx.body[key] !== undefined) {
            changes[key] = ctx.body[key];
          }
        }
        if (Object.keys(changes).length === 0) {
          return { status: 400, data: { error: 'No valid fields to update' } };
        }
        const updated = this.data.update('teams', team.id, changes);
        this.events.publish('iam.team.updated', {
          team_id: team.id,
          changes,
        }, { publisher: 'iam' });
        return { status: 200, data: updated };
      },

      deleteTeam: (ctx) => {
        const team = this.data.find('teams', ctx.params.teamId);
        if (!team) return { status: 404, data: { error: 'Team not found' } };

        // Remove all team members first
        const members = this.data.query('team_members', { team_id: team.id });
        for (const m of members) {
          this.data.delete('team_members', m.id);
        }
        this.data.delete('teams', team.id);

        this.events.publish('iam.team.deleted', {
          team_id: team.id,
        }, { publisher: 'iam' });

        return { status: 200, data: { deleted: 1 } };
      },

      listTeamMembers: (ctx) => {
        const team = this.data.find('teams', ctx.params.teamId);
        if (!team) return { status: 404, data: { error: 'Team not found' } };

        const members = this.data.query('team_members', { team_id: team.id });
        const result = members.map((m) => {
          const user = this.getUser(m.user_id);
          return {
            id: m.id,
            team_id: m.team_id,
            user_id: m.user_id,
            role: m.role,
            email: user?.email || null,
            name: user?.name || null,
            created_at: m.created_at,
          };
        });
        return { status: 200, data: result };
      },

      addTeamMember: (ctx) => {
        const team = this.data.find('teams', ctx.params.teamId);
        if (!team) return { status: 404, data: { error: 'Team not found' } };

        const { user_id, role } = ctx.body;
        if (!user_id) return { status: 400, data: { error: 'user_id is required' } };

        // Check if already a member
        const existing = this.data.query('team_members', { team_id: team.id, user_id });
        if (existing.length > 0) {
          return { status: 409, data: { error: 'User is already a member of this team' } };
        }

        const member = this.data.insert('team_members', {
          team_id: team.id,
          user_id,
          role: role || 'member',
        });

        this.events.publish('iam.team.member_added', {
          team_id: team.id,
          user_id,
          role: member.role,
        }, { publisher: 'iam' });

        return { status: 201, data: member };
      },

      removeTeamMember: (ctx) => {
        const team = this.data.find('teams', ctx.params.teamId);
        if (!team) return { status: 404, data: { error: 'Team not found' } };

        const { user_id } = ctx.body;
        if (!user_id) return { status: 400, data: { error: 'user_id is required' } };

        const members = this.data.query('team_members', { team_id: team.id, user_id });
        if (members.length === 0) {
          return { status: 404, data: { error: 'Member not found in this team' } };
        }
        for (const m of members) {
          this.data.delete('team_members', m.id);
        }

        this.events.publish('iam.team.member_removed', {
          team_id: team.id,
          user_id,
        }, { publisher: 'iam' });

        return { status: 200, data: { removed: 1 } };
      },
    };
  }

  // ── Identity ──────────────────────────────────────────────

  getUser(userId) {
    const user = this.data.find('users', userId);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  signUp({ email, password, name }) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { error: 'Valid email required' };
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return { error: 'Password must be at least 8 characters' };
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return { error: 'Name is required' };
    }

    const existing = this.data.query('users', { email });
    if (existing.length > 0) return { error: 'Unable to create account. Please try a different email or sign in.' };

    const passwordDigest = bcrypt.hashSync(password, 10);
    const user = this.data.insert('users', {
      email,
      password_digest: passwordDigest,
      name: name || email.split('@')[0],
      role: 'user',
    });

    const tokens = this._createTokens(user);
    this.events.publish('iam.user.authenticated', { user_id: user.id, email: user.email }, { publisher: 'iam' });
    return { user: this._safeUser(user), ...tokens };
  }

  signIn({ email, password }) {
    const users = this.data.query('users', { email });
    const user = users[0];

    const dummyHash = '$2b$10$invalidhashpadding000000000000000000000000000000';
    const digest = user?.password_digest || dummyHash;
    const valid = bcrypt.compareSync(password || '', digest);

    if (!user || !valid) {
      this.events.publish('iam.auth.failed', {
        email,
        reason: !user ? 'unknown_email' : 'wrong_password',
        timestamp: new Date().toISOString(),
      }, { publisher: 'iam' });
      return { error: 'Invalid credentials' };
    }

    const tokens = this._createTokens(user);
    this.events.publish('iam.user.authenticated', { user_id: user.id, email: user.email }, { publisher: 'iam' });
    return { user: this._safeUser(user), ...tokens };
  }

  refreshToken(refreshJti) {
    const tokens = this.data.query('refresh_tokens', { jti: refreshJti });
    const rt = tokens[0];
    if (!rt) return { error: 'Invalid refresh token' };
    if (rt.expires_at && new Date(rt.expires_at) < new Date()) return { error: 'Refresh token expired' };

    const user = this.data.find('users', rt.user_id);
    if (!user) return { error: 'User not found' };

    this.data.delete('refresh_tokens', rt.id);
    const newTokens = this._createTokens(user);
    return { user: this._safeUser(user), ...newTokens };
  }

  validateToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      const user = this.data.find('users', payload.sub);
      if (!user) return null;

      const revoked = this.data.query('revoked_tokens', { jti: payload.jti });
      const userRevoked = this.data.query('revoked_tokens', { jti: `user:${payload.sub}` });
      if (revoked.length > 0 || userRevoked.length > 0) return null;

      return this._safeUser(user);
    } catch {
      return null;
    }
  }

  revokeUserSessions(userId) {
    const tokens = this.data.query('refresh_tokens', { user_id: userId });
    for (const rt of tokens) {
      this.data.delete('refresh_tokens', rt.id);
    }
    this.data.insert('revoked_tokens', {
      jti: `user:${userId}`,
      user_id: userId,
      revoked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + this.jwtTtl * 1000).toISOString(),
    });
    this.events.publish('iam.session.revoked', { user_id: userId, revoked_count: tokens.length }, { publisher: 'iam' });
    return { revoked: tokens.length };
  }

  _createTokens(user) {
    const maxSessions = this.maxSessions;
    const existing = this.data.query('refresh_tokens', { user_id: user.id }, { order: 'created_at' });
    if (existing.length >= maxSessions) {
      const toRemove = existing.slice(0, existing.length - maxSessions + 1);
      for (const old of toRemove) {
        this.data.delete('refresh_tokens', old.id);
      }
    }

    const jti = uuid();
    const exp = Math.floor(Date.now() / 1000) + this.jwtTtl;
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, jti, exp },
      this.jwtSecret
    );

    const refreshJti = uuid();
    this.data.insert('refresh_tokens', {
      user_id: user.id,
      jti: refreshJti,
      expires_at: new Date(Date.now() + this.refreshTtl * 1000).toISOString(),
    });

    this.events.publish('iam.session.created', { user_id: user.id, jti }, { publisher: 'iam' });
    return { access_token: accessToken, refresh_token: refreshJti };
  }

  _safeUser(user) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  // ── Admin ─────────────────────────────────────────────────

  _seedDefaultRoles() {
    const defaults = [
      { name: 'super-admin', description: 'Full system access', permissions: '["*"]' },
      { name: 'admin', description: 'Administrative access', permissions: '["admin.read","admin.write","admin.users"]' },
      { name: 'member', description: 'Standard member access', permissions: '["read","write"]' },
      { name: 'viewer', description: 'Read-only access', permissions: '["read"]' },
    ];
    for (const role of defaults) {
      const existing = this.data.query('roles', { name: role.name });
      if (existing.length === 0) {
        this.data.insert('roles', role);
      }
    }
  }

  // ── Profile ───────────────────────────────────────────────

  _findOrCreateProfile(userId) {
    const rows = this.data.query('profiles', { user_id: userId });
    if (rows.length > 0) return rows[0];
    return this.data.insert('profiles', {
      user_id: userId,
      display_name: '',
      bio: '',
      avatar_url: '',
      timezone: 'UTC',
      theme: 'dark',
      notification_email: 1,
      notification_mentions: 1,
      notification_due_dates: 1,
    });
  }

  // ── Teams ─────────────────────────────────────────────────
  // (All team methods are implemented as route handlers above)

  // ── Subscriptions ─────────────────────────────────────────

  setupSubscriptions(eventBus) {
    eventBus.subscribe('iam.user.authenticated', 'iam', (payload) => {
      try {
        const userId = payload.user_id || payload.userId;
        if (userId) {
          this._findOrCreateProfile(userId);
        }
      } catch (e) {
        // gracefully handle subscription errors
      }
    });
  }
}
