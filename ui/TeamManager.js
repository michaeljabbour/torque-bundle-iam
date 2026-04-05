import { Stack, Text, TextField, Button, Form, Card, Avatar, Icon, Spinner, Alert, Divider } from './ui-kit.js';

export default function TeamManager({ data, actions }) {
  const teams = Array.isArray(data) ? data : (Array.isArray(data?.[0]) ? data[0] : []);
  if (!data) return Spinner({});

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 800, mx: 'auto' } }, [
    // Header
    Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
      Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
        Icon({ name: 'group' }),
        Text({ variant: 'h5', content: `Teams (${teams.length})` }),
      ]),
    ]),

    // Create team form
    Card({}, [
      Stack({ spacing: 1, sx: { p: 2 } }, [
        Text({ variant: 'subtitle2', content: 'Create Team' }),
        Form({ onSubmit: async (e) => {
          const name = e.target.elements.name?.value;
          const description = e.target.elements.description?.value;
          if (!name) return;
          await actions.api('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description }),
          });
          e.target.reset();
          actions.refresh();
        }}, [
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
            TextField({ name: 'name', placeholder: 'Team name', sx: { flex: 1 } }),
            TextField({ name: 'description', placeholder: 'Description', sx: { flex: 2 } }),
            Button({ label: 'Create', variant: 'contained', type: 'submit', size: 'small' }),
          ]),
        ]),
      ]),
    ]),

    Divider(),

    // Teams list — each team is an expandable card
    ...teams.map((team) => {
      const members = Array.isArray(team.members) ? team.members : [];
      const boards = Array.isArray(team.boards) ? team.boards : [];

      return Card({ sx: { mb: 1 } }, [
        Stack({ spacing: 1, sx: { p: 2 } }, [
          // Team header
          Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
            Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
              Icon({ name: 'group', sx: { color: 'primary.main' } }),
              Stack({ spacing: 0.25 }, [
                Text({ content: team.name, variant: 'body1', sx: { fontWeight: 700 } }),
                Text({ content: team.description || '', variant: 'caption', sx: { color: 'text.secondary' } }),
              ]),
            ]),
            Stack({ direction: 'row', spacing: 0.5 }, [
              Button({
                label: 'Edit',
                variant: 'outlined',
                size: 'small',
                onClick: async () => {
                  const newName = prompt('Team name:', team.name);
                  if (newName === null) return;
                  await actions.api(`/api/teams/${team.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName }),
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
                  if (!confirm(`Delete team "${team.name}"?`)) return;
                  await actions.api(`/api/teams/${team.id}`, { method: 'DELETE' });
                  actions.refresh();
                },
              }),
            ]),
          ]),

          Divider(),

          // Members section
          Stack({ spacing: 1 }, [
            Text({ variant: 'subtitle2', content: `Members (${members.length})` }),
            ...members.map((member) => {
              const initials = (member.name || member.email || 'U')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between', py: 0.5 } }, [
                Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                  Avatar({
                    src: member.avatar_url || null,
                    alt: member.name || member.email,
                    fallback: initials,
                    size: 32,
                  }),
                  Stack({ spacing: 0 }, [
                    Text({ content: member.name || member.email || 'Unknown', variant: 'body2', sx: { fontWeight: 600 } }),
                    Text({ content: member.role || 'member', variant: 'caption', sx: { color: 'text.secondary' } }),
                  ]),
                ]),
                Button({
                  label: 'Remove',
                  variant: 'text',
                  size: 'small',
                  color: 'error',
                  onClick: async () => {
                    await actions.api(`/api/teams/${team.id}/members`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: member.user_id || member.id }),
                    });
                    actions.refresh();
                  },
                }),
              ]);
            }),

            // Invite member form
            Form({ onSubmit: async (e) => {
              const userId = e.target.elements.user_id?.value;
              const role = e.target.elements.member_role?.value || 'member';
              if (!userId) return;
              await actions.api(`/api/teams/${team.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, role }),
              });
              e.target.reset();
              actions.refresh();
            }}, [
              Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'flex-end' } }, [
                TextField({ name: 'user_id', placeholder: 'User ID to invite', sx: { flex: 1 }, size: 'small' }),
                TextField({ name: 'member_role', placeholder: 'Role (member/admin)', sx: { flex: 1 }, size: 'small' }),
                Button({ label: 'Invite', variant: 'outlined', type: 'submit', size: 'small' }),
              ]),
            ]),
          ]),

          Divider(),

          // Boards section
          Stack({ spacing: 1 }, [
            Text({ variant: 'subtitle2', content: `Boards (${boards.length})` }),
            ...boards.map((board) =>
              Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between', py: 0.5 } }, [
                Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
                  Icon({ name: 'dashboard', sx: { fontSize: 18, color: 'text.secondary' } }),
                  Text({ content: board.name || board.title || 'Untitled Board', variant: 'body2' }),
                ]),
                Button({
                  label: 'Move',
                  variant: 'text',
                  size: 'small',
                  onClick: async () => {
                    const targetTeamId = prompt('Move to team ID:');
                    if (!targetTeamId) return;
                    await actions.api(`/api/teams/${team.id}/boards/${board.id}/move`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ target_team_id: targetTeamId }),
                    });
                    actions.refresh();
                  },
                }),
              ])
            ),
            boards.length === 0
              ? Text({ variant: 'body2', content: 'No boards assigned', sx: { color: 'text.disabled' } })
              : null,
          ]),
        ]),
      ]);
    }),

    teams.length === 0
      ? Alert({ severity: 'info', content: 'No teams found. Create one above.' })
      : null,
  ].filter(Boolean));
}
