# notify-contact-request

שולח מייל לכל הסופר אדמינים כשמתקבלת פנייה חדשה (`contact_upgrade_requests`).

## איך זה עובד

1. משתמש שולח טופס "צור קשר / בקשת שדרוג" ב-`PlansPage`.
2. השורה נשמרת בטבלת `contact_upgrade_requests`.
3. הפרונטאנד קורא ל-Edge Function הזו עם `requestId`.
4. הפונקציה (ב-service role) שולפת את פרטי הפנייה + את כל כתובות המייל של
   `user_profiles` עם `role = 'super_admin'`, ושולחת מייל דרך Resend.

## הקמה חד-פעמית

### 1. חשבון Resend
- הירשמו ב-https://resend.com וצרו API key.
- לשליחה אמיתית: אמתו דומיין (Domains → Add Domain) והגדירו כתובת שולח משלכם.
- לבדיקות בלבד: אפשר לא לאמת דומיין ולהשתמש ב-`onboarding@resend.dev`,
  אבל אז Resend שולח **רק** לכתובת שאיתה נרשמתם.

### 2. התקנת Supabase CLI (אם עוד לא מותקן)
```bash
npm install -g supabase
supabase login
supabase link --project-ref klcbyywghzggqauvvczj
```

### 3. הגדרת ה-secrets
```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
# אופציונלי (אחרי אימות דומיין):
supabase secrets set MAIL_FROM="גיימיפיקציה <noreply@yourdomain.com>"
```
`SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מסופקים אוטומטית לפונקציה.

### 4. פריסה
```bash
supabase functions deploy notify-contact-request
```
(`verify_jwt = false` כבר מוגדר ב-`supabase/config.toml` כדי לאפשר גם פניות
מעמוד התמחור ללא התחברות.)

## בדיקה
```bash
curl -i -X POST \
  "https://klcbyywghzggqauvvczj.functions.supabase.co/notify-contact-request" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"<id-של-פנייה-קיימת>"}'
```
תשובה תקינה: `{"ok":true,"sent":<מספר>}`. שגיאות נרשמות ב-Function Logs בדשבורד.
