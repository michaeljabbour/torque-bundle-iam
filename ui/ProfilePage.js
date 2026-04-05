import { Stack, Text, TextField, Button, Card, Avatar, InlineEdit, Alert, Divider } from './ui-kit.js';

export default function ProfilePage({ data, actions }) {
  const profile = (Array.isArray(data) ? data[0] : data) || {};
  let error = null;

  const initials = (profile.display_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  async function patchProfile(payload) {
    try {
      await actions.api('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      actions.refresh();
    } catch (err) {
      error = err.message || 'Failed to update profile';
      actions.refresh();
    }
  }

  return Stack({ spacing: 2, sx: { p: 2, maxWidth: 600, mx: 'auto' } }, [
    error ? Alert({ severity: 'error', content: error }) : null,

    // Avatar area
    Stack({ spacing: 1, sx: { alignItems: 'center', mb: 1 } }, [
      Avatar({
        src: profile.avatar_url || null,
        alt: profile.display_name || 'User',
        fallback: initials,
        size: 96,
      }),
      memberSince
        ? Text({
            variant: 'caption',
            content: 'Member since ' + memberSince,
            sx: { color: 'text.disabled' },
          })
        : null,
    ]),

    // Profile fields
    Card({}, [
      Stack({ spacing: 2, sx: { p: 2 } }, [
        Text({ variant: 'subtitle2', content: 'Display Name' }),
        InlineEdit({
          value: profile.display_name || '',
          placeholder: 'Enter display name',
          onSave: (value) => patchProfile({ display_name: value }),
        }),

        Divider(),

        Text({ variant: 'subtitle2', content: 'Email' }),
        Text({
          variant: 'body2',
          content: profile.email || profile.user_email || '(no email on file)',
          sx: { color: 'text.secondary' },
        }),

        Divider(),

        Text({ variant: 'subtitle2', content: 'Bio' }),
        InlineEdit({
          value: profile.bio || '',
          placeholder: 'Tell us about yourself',
          onSave: (value) => patchProfile({ bio: value }),
          multiline: true,
        }),

        Divider(),

        Text({ variant: 'subtitle2', content: 'Avatar URL' }),
        Stack({ direction: 'row', spacing: 1 }, [
          TextField({
            name: 'avatar_url',
            placeholder: 'https://example.com/avatar.png',
            value: profile.avatar_url || '',
            sx: { flex: 1 },
          }),
          Button({
            label: 'Update Avatar',
            variant: 'outlined',
            onClick: (e) => {
              const input = e.target?.closest?.('form')?.elements?.avatar_url?.value
                || document.querySelector('[name="avatar_url"]')?.value;
              if (input) patchProfile({ avatar_url: input });
            },
          }),
        ]),

        Divider(),

        Text({ variant: 'subtitle2', content: 'Timezone' }),
        Stack({ direction: 'row', spacing: 1 }, [
          TextField({
            name: 'timezone',
            placeholder: 'UTC',
            value: profile.timezone || 'UTC',
            sx: { flex: 1 },
          }),
          Button({
            label: 'Update',
            variant: 'outlined',
            onClick: (e) => {
              const input = e.target?.closest?.('form')?.elements?.timezone?.value
                || document.querySelector('[name="timezone"]')?.value;
              if (input) patchProfile({ timezone: input });
            },
          }),
        ]),
      ]),
    ]),
  ].filter(Boolean));
}
