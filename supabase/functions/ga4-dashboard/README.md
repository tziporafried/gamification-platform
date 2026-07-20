# ga4-dashboard

מחזיר payload מוכן להצגה עבור טאב **אנליטיקות** בפאנל האדמין.
קורא ל-Google Analytics Data API בצד השרת בלבד (service account).

## הרשאות

- דורש JWT תקין של משתמש מחובר
- בודק ש-`user_profiles.role === 'super_admin'`
- מחזיר 401 / 403 למשתמשים לא מורשים

## Secrets נדרשים

```bash
supabase secrets set GA4_PROPERTY_ID=123456789
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=analytics-reader@YOUR_PROJECT.iam.gserviceaccount.com
supabase secrets set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

| Secret | איפה להשיג |
|---|---|
| `GA4_PROPERTY_ID` | GA4 → Admin → Property settings → Property ID (מספר בלבד, בלי `G-`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Cloud Console → IAM → Service Accounts → Email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Service Account → Keys → Add key → JSON → השדה `private_key` |

בנוסף: לתת ל-service account הרשאת **Viewer** על ה-GA4 property
(GA4 → Admin → Property access management).

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` מסופקים אוטומטית.

## פריסה

```bash
supabase functions deploy ga4-dashboard
```

## Request

```json
POST /ga4-dashboard
Authorization: Bearer <user-jwt>
{ "preset": "7d" }
```

Presets: `today` | `7d` | `14d` | `28d` | `custom`  
ל-custom: `{ "preset": "custom", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }`

## Reports

1. Core events by `eventName` (totalUsers + eventCount) - includes `video_progress`, `event_creation_start`
2. Homepage `page_view` with `pagePath = /`
3. FAQ questions (`customEvent:question`) - soft-fail, limit 50
4. CTA by name (`customEvent:cta_name`) - soft-fail
5. CTA by location (`customEvent:cta_location`) - soft-fail
6. CTA name × location matrix - soft-fail
7. Video progress milestones (`customEvent:progress_percent`) - soft-fail
8. Event creation method (`customEvent:creation_method`) - soft-fail
9. Lead / contact open by `contact_source` - soft-fail
10. Select plan by `plan_name` - soft-fail
11. Activation options by `source` - soft-fail
12. Daily time series - homepage visitors by `date` + events (`video_view`, `view_plans`, `generate_lead`) by `date`×`eventName`
13. Traffic sources by `sessionSource` (grouped into ישיר / Google / הפניה / קמפיינים / אחר) - soft-fail
14. UTM tagged visitors + `utm_source` / `utm_campaign` / `utm_content` breakdowns + link performance (video / plans / leads by `utm_content`) - soft-fail; returns `unavailableParams` when Custom Dimensions are missing

## Response extras

- `timeSeries.days[]` - `{ date, visitors, videoView, viewPlans, generateLead }`
- `trafficSources.items[]` - `{ label, users }` + `totalUsers`
- `utm` - `{ taggedVisitors, sourceBreakdown, campaignBreakdown, contentBreakdown, linkPerformance, unavailable, unavailableParams }`

