import { Stack, Text, TextField, Button, Form, Card, Badge, Avatar, FilterDropdown, Spinner, Alert, Divider } from './ui-kit.js';

export default function UserManager({ data, actions }) {
  const users = Array.isArray(data) ? data : (Array.isArray(data?.[0]) ? data[0] : []);
  if (!data) return Spinner({});

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 900, mx: 'auto' } }, [
    Text({ variant: 'h5', content: `Users (${users.length})` }),

    // Create user form
    Card({}, [
      Stack({ spacing: 1, sx: { p: 2 } }, [
        Text({ variant: 'subtitle2', content: 'Create User' }),
        Form({ onSubmit: async (e) => {
          const name = e.target.elements.name?.value;
          const email = e.target.elements.email?.value;
          const password = e.target.elements.password?.value;
          if (!email || !password) return;
          await actions.api('/api/identity/sign_up', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
          });
          e.target.reset();
          actions.refresh();
        }}, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
            TextField({ name: 'name', placeholder: 'Name', sx: { flex: 1 } }),
            TextField({ name: 'email', placeholder: 'Email', type: 'email', sx: { flex: 1 } }),
            TextField({ name: 'password', placeholder: 'Password', type: 'password', sx: { flex: 1 } }),
            Button({ label: 'Create', variant: 'contained', type: 'submit', size: 'small' }),
          ]),
        ]),
      ]),
    ]),

    Divider(),

    // Users list
    ...users.map((user) => {
      const userRoles = Array.isArray(user.roles) ? user.roles : [];
      const initials = (user.name || user.email || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      return Card({ sx: { mb: 1 } }, [
        Stack({ direction: 'row', spacing: 2, sx: { p: 2, alignItems: 'center' } }, [
          // Avatar
          Avatar({
            src: user.avatar_url || null,
            alt: user.name || user.email,
            fallback: initials,
            size: 40,
          }),

          // Name + email
          Stack({ spacing: 0.25, sx: { flex: 1, minWidth: 0 } }, [
            Text({ content: user.name || 'Unnamed', variant: 'body2', sx: { fontWeight: 600 } }),
            Text({ content: user.email || '-', variant: 'caption', sx: { color: 'text.secondary' } }),
          ]),

          // Role badges with revoke
          Stack({ direction: 'row', spacing: 0.5, sx: { flexWrap: 'wrap', alignItems: 'center' } }, [
            ...userRoles.map((r) => {
              const roleName = typeof r === 'string' ? r : r.role_name || r.name;
              const roleId = typeof r === 'string' ? r : r.role_id || r.id;
              return Badge({
                content: roleName,
                variant: 'filled',
                sx: { cursor: 'pointer' },
                onDelete: async () => {
                  await actions.api(`/api/admin/users/${user.id || user.user_id}/roles/${roleId}`, {
                    method: 'DELETE',
                  });
                  actions.refresh();
                },
              });
            }),

            // Assign role dropdown
            FilterDropdown({
              label: '+ Role',
              placeholder: 'Select role',
              name: `assign_role_${user.id || user.user_id}`,
              size: 'small',
              onSelect: async (roleId) => {
                await actions.api(`/api/admin/users/${user.id || user.user_id}/roles`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role_id: roleId }),
                });
                actions.refresh();
              },
            }),
          ]),
        ]),
      ]);
    }),

    users.length === 0
      ? Alert({ severity: 'info', content: 'No users found.' })
      : null,

    Divider(),

    // Manual assign form fallback
    Card({}, [
      Stack({ spacing: 1, sx: { p: 2 } }, [
        Text({ variant: 'subtitle2', content: 'Assign Role Manually' }),
        Form({ onSubmit: async (e) => {
          const userId = e.target.elements.userId?.value;
          const roleName = e.target.elements.roleName?.value;
          const scopeType = e.target.elements.scopeType?.value;
          const scopeId = e.target.elements.scopeId?.value;
          if (!userId || !roleName) return;
          await actions.api(`/api/admin/users/${userId}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role_id: roleName,
              scope_type: scopeType || null,
              scope_id: scopeId || null,
            }),
          });
          e.target.reset();
          actions.refresh();
        }}, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
            TextField({ name: 'userId', placeholder: 'User ID', sx: { flex: 1 } }),
            TextField({ name: 'roleName', placeholder: 'Role name', sx: { flex: 1 } }),
            TextField({ name: 'scopeType', placeholder: 'Scope type', sx: { flex: 1 } }),
            TextField({ name: 'scopeId', placeholder: 'Scope ID', sx: { flex: 1 } }),
            Button({ label: 'Assign', variant: 'contained', type: 'submit', size: 'small' }),
          ]),
        ]),
      ]),
    ]),
  ].filter(Boolean));
}
