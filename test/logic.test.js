import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import IAM from '../logic.js';
import { createMockData, createMockEvents, createMockCoordinator } from './helpers.js';

describe('IAM bundle', () => {
  let iam, data, events;

  beforeEach(() => {
    data = createMockData();
    events = createMockEvents();
    iam = new IAM({
      data,
      events,
      config: { config: { jwt_secret: 'test-secret-key-for-unit-tests' } },
      coordinator: createMockCoordinator(),
    });
  });

  describe('constructor', () => {
    it('creates an instance with valid config', () => {
      assert.ok(iam);
      assert.equal(iam.jwtSecret, 'test-secret-key-for-unit-tests');
    });

    it('throws when jwt_secret is missing', () => {
      assert.throws(() => {
        new IAM({
          data: createMockData(),
          events: createMockEvents(),
          config: { config: {} },
          coordinator: createMockCoordinator(),
        });
      }, /jwt_secret is required/);
    });

    it('seeds default roles on construction', () => {
      const roles = data.query('roles', {});
      const names = roles.map((r) => r.name);
      assert.ok(names.includes('super-admin'));
      assert.ok(names.includes('admin'));
      assert.ok(names.includes('member'));
      assert.ok(names.includes('viewer'));
    });

    it('uses default jwt_ttl when not configured', () => {
      assert.equal(iam.jwtTtl, 3600);
    });
  });

  describe('routes()', () => {
    it('returns an object with route handlers', () => {
      const routes = iam.routes();
      assert.equal(typeof routes, 'object');
      assert.ok(Object.keys(routes).length > 0);
    });

    it('exposes signUp route', () => {
      assert.equal(typeof iam.routes().signUp, 'function');
    });

    it('exposes signIn route', () => {
      assert.equal(typeof iam.routes().signIn, 'function');
    });

    it('exposes me route', () => {
      assert.equal(typeof iam.routes().me, 'function');
    });

    it('exposes admin routes', () => {
      const routes = iam.routes();
      assert.equal(typeof routes.listRoles, 'function');
      assert.equal(typeof routes.createRole, 'function');
      assert.equal(typeof routes.assignRole, 'function');
    });

    it('exposes profile routes', () => {
      const routes = iam.routes();
      assert.equal(typeof routes.getMyProfile, 'function');
      assert.equal(typeof routes.updateProfile, 'function');
      assert.equal(typeof routes.getSettings, 'function');
    });

    it('exposes team routes', () => {
      const routes = iam.routes();
      assert.equal(typeof routes.listTeams, 'function');
      assert.equal(typeof routes.createTeam, 'function');
      assert.equal(typeof routes.addTeamMember, 'function');
    });
  });

  describe('interfaces()', () => {
    it('returns an object with interface handlers', () => {
      const ifaces = iam.interfaces();
      assert.equal(typeof ifaces, 'object');
    });

    it('exposes getUser interface', () => {
      assert.equal(typeof iam.interfaces().getUser, 'function');
    });

    it('exposes validateToken interface', () => {
      assert.equal(typeof iam.interfaces().validateToken, 'function');
    });

    it('exposes hasRole interface', () => {
      assert.equal(typeof iam.interfaces().hasRole, 'function');
    });

    it('exposes hasPermission interface', () => {
      assert.equal(typeof iam.interfaces().hasPermission, 'function');
    });

    it('exposes getProfile interface', () => {
      assert.equal(typeof iam.interfaces().getProfile, 'function');
    });

    it('exposes getUserPreferences interface', () => {
      assert.equal(typeof iam.interfaces().getUserPreferences, 'function');
    });
  });

  describe('intents()', () => {
    it('returns an empty object', () => {
      const intents = iam.intents();
      assert.deepEqual(intents, {});
    });
  });

  describe('signUp', () => {
    it('creates a user and returns tokens', () => {
      const result = iam.signUp({ email: 'test@example.com', password: 'password123', name: 'Test User' });
      assert.ok(result.user);
      assert.equal(result.user.email, 'test@example.com');
      assert.equal(result.user.name, 'Test User');
      assert.ok(result.access_token);
      assert.ok(result.refresh_token);
    });

    it('publishes iam.user.authenticated event', () => {
      iam.signUp({ email: 'test@example.com', password: 'password123', name: 'Test User' });
      const event = events._published.find((e) => e.name === 'iam.user.authenticated');
      assert.ok(event);
      assert.equal(event.payload.email, 'test@example.com');
    });

    // Invalid email, short password, missing name are structural validations
    // now handled by the manifest validate: block — not tested inline here.

    it('rejects duplicate email', () => {
      iam.signUp({ email: 'dup@example.com', password: 'password123', name: 'First' });
      const result = iam.signUp({ email: 'dup@example.com', password: 'password456', name: 'Second' });
      assert.ok(result.error);
    });
  });

  describe('signIn', () => {
    it('authenticates with correct credentials', () => {
      iam.signUp({ email: 'login@example.com', password: 'password123', name: 'Login User' });
      const result = iam.signIn({ email: 'login@example.com', password: 'password123' });
      assert.ok(result.user);
      assert.equal(result.user.email, 'login@example.com');
      assert.ok(result.access_token);
    });

    it('rejects wrong password', () => {
      iam.signUp({ email: 'login@example.com', password: 'password123', name: 'Login User' });
      const result = iam.signIn({ email: 'login@example.com', password: 'wrong' });
      assert.ok(result.error);
    });

    it('rejects unknown email', () => {
      const result = iam.signIn({ email: 'nobody@example.com', password: 'password123' });
      assert.ok(result.error);
    });
  });

  describe('signUp route', () => {
    it('returns 201 on success', () => {
      const result = iam.routes().signUp({
        body: { email: 'route@example.com', password: 'password123', name: 'Route User' },
      });
      assert.equal(result.status, 201);
      assert.ok(result.data.user);
    });

    // Structural validation (invalid email, short password, missing name) is
    // handled by the manifest validate: block — not tested inline here.
  });

  describe('roles (admin routes)', () => {
    it('listRoles returns seeded default roles', () => {
      const result = iam.routes().listRoles({});
      assert.equal(result.status, 200);
      assert.ok(result.data.length >= 4);
    });

    it('createRole creates a new role', () => {
      const result = iam.routes().createRole({ body: { name: 'editor', description: 'Can edit', permissions: '["edit"]' } });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'editor');
    });

    // Required name validation is handled by the manifest validate: block — not tested inline here.

    it('createRole rejects duplicate name', () => {
      iam.routes().createRole({ body: { name: 'custom-role' } });
      const result = iam.routes().createRole({ body: { name: 'custom-role' } });
      assert.equal(result.status, 409);
    });
  });

  describe('teams routes', () => {
    it('createTeam creates a team and adds creator as owner', () => {
      const result = iam.routes().createTeam({
        body: { name: 'My Team' },
        currentUser: { id: 'user-1' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.name, 'My Team');

      const members = data.query('team_members', { team_id: result.data.id });
      assert.equal(members.length, 1);
      assert.equal(members[0].role, 'owner');
    });

    // Required name validation is handled by the manifest validate: block — not tested inline here.

    it('listTeams returns created teams', () => {
      iam.routes().createTeam({ body: { name: 'Alpha' }, currentUser: { id: 'user-1' } });
      iam.routes().createTeam({ body: { name: 'Beta' }, currentUser: { id: 'user-1' } });
      const result = iam.routes().listTeams({});
      assert.equal(result.status, 200);
      assert.equal(result.data.length, 2);
    });
  });

  describe('setupSubscriptions', () => {
    it('subscribes to iam.user.authenticated', () => {
      const subscribed = [];
      const mockBus = { subscribe(event, bundle, handler) { subscribed.push({ event, bundle }); } };
      iam.setupSubscriptions(mockBus);
      assert.ok(subscribed.find((s) => s.event === 'iam.user.authenticated'));
    });
  });
});
