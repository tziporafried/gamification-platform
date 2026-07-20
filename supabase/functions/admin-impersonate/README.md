# admin-impersonate

Lets a `super_admin` switch into a regular user's real Supabase session
("login as user") so support can see exactly what that customer sees,
including RLS-scoped data.

## Auth

Requires a valid user JWT whose `user_profiles.role` is `super_admin`.
Cannot impersonate yourself or another super admin.

## Request

```json
{ "userId": "<uuid>" }
```

## Response

```json
{
  "token_hash": "<one-time hashed token>",
  "email": "customer@example.com",
  "display_name": "…"
}
```

The browser exchanges `token_hash` via `supabase.auth.verifyOtp({ type: 'email' })`.
No email is sent — `auth.admin.generateLink` only mints the token.

## Deploy

```bash
supabase functions deploy admin-impersonate
```
