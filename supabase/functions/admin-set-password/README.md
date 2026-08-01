# admin-set-password

Lets a `super_admin` set a new password for a customer from the admin
panel's customers tab. The app has no self-service "forgot password"
screen, so support hands the customer the new password directly.

## Auth

Requires a valid user JWT whose `user_profiles.role` is `super_admin`.
Cannot target yourself or another super admin.

## Request

```json
{ "userId": "<uuid>", "password": "<at least 6 chars>" }
```

## Response

```json
{ "email": "customer@example.com" }
```

The customer's existing sessions keep working until they expire - Supabase
does not revoke them on a password change. Anyone who knew the old password
can no longer sign in with it.

## Deploy

```bash
supabase functions deploy admin-set-password
```
