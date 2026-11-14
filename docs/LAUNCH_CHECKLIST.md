# PulseHive launch checklist

## Must do before real users
- [ ] **Email works for everyone.** Resend (or similar) is connected, `pulsehive.app` shows Verified, and a brand-new email address receives the confirmation email.
- [ ] **Addresses are correct.** `NEXT_PUBLIC_SITE_URL` is `https://pulsehive.app` in Vercel; Supabase Site URL and Redirect URLs use `https://pulsehive.app`. Vercel Deployment Protection (Vercel Authentication) is off.
- [ ] **Supabase plan.** Free projects pause after about a week with no activity, which would take PulseHive offline. Upgrade, or make sure someone uses it regularly.
- [ ] **Backups.** Free projects have no automatic restorable backups. Use a paid plan or export your data regularly.
- [ ] **Run `supabase/audit.sql`** and check every line matches what it says to expect.
- [ ] **Run the full test plan** (docs/TEST_PLAN.md) on a phone.
- [ ] **Confirm email is ON** (Supabase > Authentication > Email > Confirm email) and the minimum password length is 8.
- [ ] **Privacy Policy reviewed** for your country by someone qualified; set the minimum age and a contact email (`NEXT_PUBLIC_CONTACT_EMAIL` in Vercel).
- [ ] **A Terms of Service page** (rules for posting, what gets accounts suspended). Not built yet.

## Strongly recommended
- [ ] Bot protection on sign-up (Supabase > Authentication > Attack Protection > CAPTCHA, using Cloudflare Turnstile or hCaptcha).
- [ ] Two-step login for your admin account (Supabase supports it; the app does not require it yet).
- [ ] A way for users to report posts and people (not built yet), and a way for them to reach you (a support email).
- [ ] Error alerts (Vercel and Supabase both have logs; add an alert or Sentry if you can).
- [ ] An uptime check on pulsehive.app (free services exist).
- [ ] Keep your GitHub account protected with two-step login, since it controls what goes live.

## Known limits (not bugs)
- Private accounts with follower approval, blocking and muting are not built.
- Shared links need a PulseHive sign-in to open, so they do not show previews on other apps.
- Removed posts: the stored image files can remain in storage until cleaned up.
- Message contents are not end-to-end encrypted.
- The login history shows each person's latest sign-in only.
- Likes, comments and shares are not grouped ("A and 5 others liked your post").
- No push notifications; new posts from others appear after refresh or scroll.
