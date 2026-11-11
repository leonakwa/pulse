# Pulse architecture

**Stack:** Next.js (App Router) + TypeScript + Tailwind on Vercel; Supabase (Postgres, Auth, Storage, Realtime).
Mobile app later: Expo / React Native against the same Supabase backend.

## Principles
1. All core data lives in the database; localStorage is for harmless preferences only.
2. Authorization is enforced by Row Level Security and database functions, never by hiding UI.
3. XP is awarded only by database triggers/functions reacting to real events. Clients cannot write XP.
4. A post with an image is created only after the upload succeeds (no half-saved posts).
5. Passwords are handled only by Supabase Auth and are never stored, queried or logged by Pulse.

## XP design (phase 9)
Append-only `xp_transactions` ledger; total XP cached on the profile by trigger. Anti-farming in SQL: no XP for
your own likes/comments, daily caps per action, one award per (actor, target, action), levels derived by a function.

## Admin design (phase 12)
`admin_users` has no client policies; `is_admin()` is checked in RLS and security-definer functions. Suspending
sets `profiles.status`; the app shows "Account unavailable" and RLS hides the profile from others.

## Roadmap
| # | Phase | Status |
|---|-------|--------|
| 1 | Scaffold, email auth, foundation schema | Sign-up and login confirmed working |
| 2 | Profiles (view, edit) | Confirmed working |
| 3 | Storage and image uploads | Written, not yet tested |
| 4 | Posts and home feed | Not started |
| 5 | Likes, comments, follows UI | Not started |
| 6 | Discover and search | Not started |
| 7 | Private messaging (realtime) | Not started |
| 8 | Notifications | Not started |
| 9 | XP, levels, leaderboard | Not started |
| 10 | Sharing | Not started |
| 11 | Settings, themes, privacy policy | Not started |
| 12 | Admin dashboard | Not started |

Phone-number sign-in needs a paid SMS provider (for example Twilio), so email comes first.

## Image uploads (phase 3)
Photos are cropped and shrunk in the browser (JPEG, about a few hundred KB), then uploaded straight to Supabase
Storage, which avoids Vercel request-size limits. Storage policies only allow writes to `<your user id>/...`, and the
buckets enforce size and type limits themselves. A server action then checks the file really exists before saving its
URL to the profile; if saving fails the file is deleted again, so there are no half-saved states. The `post-images`
bucket is created now for phase 4.
