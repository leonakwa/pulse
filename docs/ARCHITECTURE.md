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
| 3 | Storage and image uploads | Confirmed working |
| 4 | Posts and home feed | Written, awaiting test result |
| 5 | Likes, comments, follows UI | Confirmed working |
| 6 | Discover and search | Written, not yet tested |
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

## Posts and feed (phase 4)
Clients cannot insert posts directly. The `create_post()` database function validates the text, checks every image
exists in storage and belongs to the user, rate-limits (20 posts per hour) and saves the post and its images in one
transaction. Edits can only change the text (column-level grant plus a trigger). The feed uses keyset pagination on
`(created_at, id)`, 10 posts per page, loaded as you scroll. "Following" shows your posts plus people you follow
(capped at 1000 follows for now); "Discover" shows everyone's. Likes, comments and the follow button arrive in phase 5.

## Engagement (phase 5)
Likes (`post_likes`, one per person per post), comments (`post_comments`, up to 300 characters, newest at the bottom)
and follows are plain tables protected by Row Level Security. Counters on `posts` (`like_count`, `comment_count`) are
maintained by database triggers, so the browser cannot fake them. Per-hour limits (300 likes, 30 comments, 100
follows) are enforced in the database. You can only follow active accounts, never yourself, and never twice.
Phase 8 (notifications) and phase 9 (XP) will hook into these same tables with triggers.

## Discover (phase 6)
People search is the `search_profiles()` database function: the text is passed as a parameter (never pasted into a
query), wildcards are escaped, exact then prefix matches rank first, and trigram indexes keep it fast. Suggestions come
from `suggested_accounts()` (active accounts you do not follow, most-followed first). Popular posts are the most-liked
of the last 30 days. Known limits: suggestions count followers per row, which is fine for thousands of users but should
become a stored counter later; private accounts (phase 11) will need to be excluded from search.
