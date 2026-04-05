import { Stack, Text, TextField, Button, Form, Card, Badge, Spinner, Alert, Divider } from './ui-kit.js';

function parsePermissions(raw) {
  try {
    const perms = JSON.parse(raw);
    if (Array.isArray(perms)) return perms;
  } catch { /* ignore */ }
  return [];
}

export default function RoleManager({ data, actions }) {
  const roles = Array.isArray(data) ? data : (Array.isArray(data?.[0]) ? data[0] : []);
  if (!data) return Spinner({});

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 800, mx: 'auto' } }, [
    Text({ variant: 'h5', content: `Roles (${roles.length})` }),

    // Create role form
    Card({}, [
      Stack({ spacing: 1, sx: { p: 2 } }, [
        Text({ variant: 'subtitle2', content: 'Create Role' }),
        Form({ onSubmit: async (e) => {
          const name = e.target.elements.name?.value;
          const description = e.target.elements.description?.value;
          if (!name) return;
          await actions.api('/api/admin/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, permissions: '[]' }),
          });
          e.target.reset();
          actions.refresh();
        }}, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
            TextField({ name: 'name', placeholder: 'Role name', sx: { flex: 1 } }),
            TextField({ name: 'description', placeholder: 'Description', sx: { flex: 2 } }),
            Button({ label: 'Create', variant: 'contained', type: 'submit', size: 'small' }),
          ]),
        ]),
      ]),
    ]),

    Divider(),

    // Roles list
    ...roles.map((role) => {
      const perms = parsePermissions(role.permissions);
      return Card({ sx: { mb: 1 } }, [
        Stack({ spacing: 1, sx: { p: 2 } }, [
          // Header row
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
            Stack({ spacing: 0.25 }, [
              Text({ content: role.name, variant: 'body1', sx: { fontWeight: 700 } }),
              Text({ content: role.description || 'No description', variant: 'body2', sx: { color: 'text.secondary' } }),
            ]),
            Stack({ direction: 'row', spacing: 0.5, sx: { alignItems: 'center' } }, [
              Text({
                content: `${role.user_count || 0} users`,
                variant: 'caption',
                sx: { color: 'text.secondary' },
              }),
              Button({
                label: 'Edit',
                variant: 'outlined',
                size: 'small',
                onClick: async () => {
                  const newDesc = prompt('New description:', role.description);
                  if (newDesc === null) return;
                  await actions.api(`/api/admin/roles/${role.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: newDesc }),
                  });
                  actions.refresh();
                },
              }),
              Button({
                label: 'Delete',
                variant: 'outlined',
                size: 'small',
                color: 'error',
                onClick: async () => {
                  if (!confirm(`Delete role "${role.name}"?`)) return;
                  await actions.api(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
                  actions.refresh();
                },
              }),
            ]),
          ]),

          // Permissions tags
          perms.length > 0
            ? Stack({ direction: 'row', spacing: 0.5, sx: { flexWrap: 'wrap' } },
                perms.map((perm) =>
                  Badge({
                    content: perm,
                    variant: 'outlined',
                    sx: { mr: 0.5, mb: 0.5 },
                  })
                )
              )
            : Text({ variant: 'caption', content: 'No permissions', sx: { color: 'text.disabled' } }),

          // Add / remove permission
          Form({ onSubmit: async (e) => {
            const perm = e.target.elements.permission?.value?.trim();
            if (!perm) return;
            const updated = [...perms, perm];
            await actions.api(`/api/admin/roles/${role.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ permissions: JSON.stringify(updated) }),
            });
            e.target.reset();
            actions.refresh();
          }}, [
            Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
              TextField({ name: 'permission', placeholder: 'Add permission', sx: { flex: 1 }, size: 'small' }),
              Button({ label: 'Add', variant: 'outlined', type: 'submit', size: 'small' }),
            ]),
          ]),

          // Remove permission buttons
          ...(perms.length > 0
            ? [Stack({ direction: 'row', spacing: 0.5, sx: { flexWrap: 'wrap' } },
                perms.map((perm) =>
                  Button({
                    label: `x ${perm}`,
                    variant: 'text',
                    size: 'small',
                    color: 'error',
                    onClick: async () => {
                      const updated = perms.filter((p) => p !== perm);
                      await actions.api(`/api/admin/roles/${role.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ permissions: JSON.stringify(updated) }),
                      });
                      actions.refresh();
                    },
                  })
                )
              )]
            : []),
        ]),
      ]);
    }),

    roles.length === 0
      ? Alert({ severity: 'info', content: 'No roles found. Create one above.' })
      : null,
  ].filter(Boolean));
}
