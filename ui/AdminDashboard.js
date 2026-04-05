import { Stack, Text, Card, Button, Spinner, Divider, StatCard, Grid, Icon, MiniBar } from './ui-kit.js';

export default function AdminDashboard({ data, actions }) {
  const stats = (Array.isArray(data) ? data[0] : data) || {};
  if (!stats) return Spinner({});

  const roles = Array.isArray(stats.roles) ? stats.roles : [];
  const teams = Array.isArray(stats.teams) ? stats.teams : [];
  const totalPerms = roles.reduce((sum, r) => {
    try { return sum + JSON.parse(r.permissions || '[]').length; } catch { return sum; }
  }, 0);

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 960, mx: 'auto' } }, [
    // Header
    Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
      Icon({ name: 'shield', sx: { fontSize: 28 } }),
      Text({ variant: 'h5', content: 'Administration' }),
    ]),

    // KPI stat cards
    Grid({ columns: 5, spacing: 1 }, [
      StatCard({ sx: { p: 2 } }, [
        Text({ variant: 'h4', content: String(stats.total_users || 0) }),
        Text({ variant: 'body2', content: 'Users', sx: { color: 'text.secondary' } }),
      ]),
      StatCard({ sx: { p: 2 } }, [
        Text({ variant: 'h4', content: String(stats.total_roles || 0) }),
        Text({ variant: 'body2', content: 'Roles', sx: { color: 'text.secondary' } }),
      ]),
      StatCard({ sx: { p: 2 } }, [
        Text({ variant: 'h4', content: String(stats.total_workspaces || 0) }),
        Text({ variant: 'body2', content: 'Workspaces', sx: { color: 'text.secondary' } }),
      ]),
      StatCard({ sx: { p: 2 } }, [
        Text({ variant: 'h4', content: String(stats.total_boards || stats.total_user_assignments || 0) }),
        Text({ variant: 'body2', content: 'Boards', sx: { color: 'text.secondary' } }),
      ]),
      StatCard({ sx: { p: 2 } }, [
        Text({ variant: 'h4', content: String(stats.total_notifications || 0) }),
        Text({ variant: 'body2', content: 'Notifications', sx: { color: 'text.secondary' } }),
      ]),
    ]),

    Divider(),

    // Teams overview + Role distribution side by side
    Grid({ columns: 2, spacing: 2 }, [
      // Teams overview
      Card({}, [
        Stack({ spacing: 1, sx: { p: 2 } }, [
          Text({ variant: 'h6', content: 'Teams Overview' }),
          ...(teams.length > 0
            ? teams.map((team) =>
                Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' } }, [
                  Stack({ spacing: 0.25 }, [
                    Text({ content: team.name, variant: 'body2', sx: { fontWeight: 600 } }),
                    Text({ content: `${team.member_count || 0} members`, variant: 'caption', sx: { color: 'text.secondary' } }),
                  ]),
                  Button({
                    label: 'View',
                    variant: 'text',
                    size: 'small',
                    onClick: () => actions.navigate('/teams'),
                  }),
                ])
              )
            : [Text({ variant: 'body2', content: 'No teams yet', sx: { color: 'text.secondary' } })]
          ),
        ]),
      ]),

      // Role distribution
      Card({}, [
        Stack({ spacing: 1, sx: { p: 2 } }, [
          Text({ variant: 'h6', content: 'Role Distribution' }),
          ...(roles.length > 0
            ? roles.map((role) => {
                const userCount = role.user_count || 0;
                const maxUsers = stats.total_users || 1;
                const pct = Math.round((userCount / maxUsers) * 100);
                return Stack({ spacing: 0.5, sx: { py: 0.5 } }, [
                  Stack({ direction: 'row', spacing: 1, sx: { justifyContent: 'space-between' } }, [
                    Text({ content: role.name, variant: 'body2', sx: { fontWeight: 600 } }),
                    Text({ content: `${userCount} users`, variant: 'caption', sx: { color: 'text.secondary' } }),
                  ]),
                  MiniBar({ value: pct, max: 100 }),
                ]);
              })
            : [Text({ variant: 'body2', content: 'No roles defined', sx: { color: 'text.secondary' } })]
          ),
        ]),
      ]),
    ]),

    Divider(),

    // Quick actions
    Stack({ direction: 'row', spacing: 1 }, [
      Button({
        label: 'Manage Roles',
        variant: 'contained',
        onClick: () => actions.navigate('/admin/roles'),
      }),
      Button({
        label: 'Manage Users',
        variant: 'outlined',
        onClick: () => actions.navigate('/admin/users'),
      }),
      Button({
        label: 'Manage Teams',
        variant: 'outlined',
        onClick: () => actions.navigate('/teams'),
      }),
    ]),
  ]);
}
