import { Stack, Text, TextField, Button, Form, Alert } from './ui-kit.js';

export default function LoginPage({ data, actions }) {
  const error = data?.error || null;

  return Stack({ spacing: 3, sx: { p: 3, maxWidth: 400, mx: 'auto', mt: 8 } }, [
    Text({ variant: 'h5', content: 'Sign in', sx: { fontWeight: 500, textAlign: 'center' } }),

    error ? Alert({ severity: 'error', content: error }) : null,

    Form({ onSubmit: async (e) => {
      const email = e.target.elements.email?.value;
      const password = e.target.elements.password?.value;
      if (!email || !password) return;
      try {
        const res = await actions.api('/api/identity/sign_in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (res.token) {
          localStorage.setItem('__torque_token__', res.token);
          if (res.refresh_token) {
            localStorage.setItem('__torque_refresh_token__', res.refresh_token);
          }
          actions.navigate('/profile');
        }
      } catch (err) {
        actions.refresh();
      }
    }}, [
      Stack({ spacing: 2 }, [
        TextField({
          label: 'Email',
          type: 'email',
          name: 'email',
          placeholder: 'you@example.com',
          required: true,
          fullWidth: true,
        }),
        TextField({
          label: 'Password',
          type: 'password',
          name: 'password',
          placeholder: 'Enter your password',
          required: true,
          fullWidth: true,
        }),
        Button({
          label: 'Sign in',
          variant: 'contained',
          fullWidth: true,
          type: 'submit',
        }),
      ]),
    ]),

    Text({
      variant: 'body2',
      content: "Don't have an account? Sign up",
      sx: { textAlign: 'center', color: 'text.secondary', cursor: 'pointer' },
      onClick: () => actions.navigate('/signup'),
    }),
  ].filter(Boolean));
}
