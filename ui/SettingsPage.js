import { Stack, Text, Button, Card, Divider, Alert } from './ui-kit.js';

export default function SettingsPage({ data, actions }) {
  const settings = (Array.isArray(data) ? data[0] : data) || {};
  let error = null;

  async function patchSetting(payload) {
    try {
      await actions.api('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (payload.theme) {
        localStorage.setItem('__torque_theme__', payload.theme);
        window.location.reload();
        return;
      }
      actions.refresh();
    } catch (err) {
      error = err.message || 'Failed to update setting';
      actions.refresh();
    }
  }

  function toggleButton(label, active, onClick) {
    return Button({
      label,
      variant: active ? 'contained' : 'outlined',
      onClick,
      sx: { textTransform: 'none' },
    });
  }

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 600, mx: 'auto' } }, [
    Text({ variant: 'h4', content: 'Settings' }),

    error ? Alert({ severity: 'error', content: error }) : null,

    // Theme section
    Card({}, [
      Stack({ spacing: 2, sx: { p: 2 } }, [
        Text({ variant: 'h6', content: 'Theme' }),
        Stack({ direction: 'row', spacing: 1 }, [
          toggleButton('Dark', settings.theme === 'dark', () =>
            patchSetting({ theme: 'dark' })
          ),
          toggleButton('Light', settings.theme === 'light', () =>
            patchSetting({ theme: 'light' })
          ),
          toggleButton('System', settings.theme === 'system', () =>
            patchSetting({ theme: 'system' })
          ),
        ]),
      ]),
    ]),

    // Notifications section
    Card({}, [
      Stack({ spacing: 2, sx: { p: 2 } }, [
        Text({ variant: 'h6', content: 'Notifications' }),

        Stack(
          { direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } },
          [
            Text({ content: 'Email notifications', variant: 'body1' }),
            toggleButton(
              settings.notification_email ? 'On' : 'Off',
              !!settings.notification_email,
              () => patchSetting({ notification_email: !settings.notification_email })
            ),
          ]
        ),

        Divider(),

        Stack(
          { direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } },
          [
            Text({ content: 'Mention notifications', variant: 'body1' }),
            toggleButton(
              settings.notification_mentions ? 'On' : 'Off',
              !!settings.notification_mentions,
              () => patchSetting({ notification_mentions: !settings.notification_mentions })
            ),
          ]
        ),

        Divider(),

        Stack(
          { direction: 'row', spacing: 1, sx: { alignItems: 'center', justifyContent: 'space-between' } },
          [
            Text({ content: 'Due date reminders', variant: 'body1' }),
            toggleButton(
              settings.notification_due_dates ? 'On' : 'Off',
              !!settings.notification_due_dates,
              () => patchSetting({ notification_due_dates: !settings.notification_due_dates })
            ),
          ]
        ),
      ]),
    ]),

    // Account section
    Card({}, [
      Stack({ spacing: 2, sx: { p: 2 } }, [
        Text({ variant: 'h6', content: 'Account' }),

        Stack({ spacing: 0.5 }, [
          Text({ variant: 'subtitle2', content: 'Email' }),
          Text({
            variant: 'body2',
            content: settings.email || settings.user_email || '(no email on file)',
            sx: { color: 'text.secondary' },
          }),
        ]),

        Divider(),

        Button({
          label: 'Sign Out',
          variant: 'outlined',
          color: 'error',
          onClick: () => {
            localStorage.clear();
            window.location.href = '/';
          },
          sx: { alignSelf: 'flex-start' },
        }),
      ]),
    ]),
  ].filter(Boolean));
}
