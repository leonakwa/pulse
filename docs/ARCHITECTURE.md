# PulseHive architecture

**Stack:** Next.js (App Router) + TypeScript + Tailwind on Vercel; Supabase (Postgres, Auth, Storage, Realtime).
Mobile app later: Expo / React Native against the same Supabase backend.

## Principles
1. All core data lives in the database; localStorage is for harmless preferences only.
2. Authorization is enforced by Row Level Security and database functions, never by hiding UI.
3. XP is awarded only by database triggers/functions reacting to real events. Clients cannot write XP.
4. A post with an image is created only after the upload succeeds (no half-saved posts).
5. Passwords are handled only by Supabase Auth and are never stored, queried or logged by PulseHive.

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
| 6 | Discover and search | Confirmed working |
| 7 | Private messaging (realtime) | Confirmed working |
| 8 | Notifications | Delivered |
| 9 | XP, levels, leaderboard | Confirmed working |
| 10 | Sharing | Confirmed working |
| 11 | Settings, themes, privacy policy | Written, not yet tested |
| 12 | Admin dashboard | Built early (before phase 10); delivered |

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

## Messaging (phase 7)
One conversation per pair of people (`direct_key`), created by `start_conversation()`. Only the two participants can
read or write (rules use the `is_participant()` helper). Messages are text only, up to 2000 characters, limited to 30
a minute, and cannot be edited or deleted yet. Unread state is `last_read_at` per participant, advanced by
`mark_conversation_read()` using the database clock. New messages reach the browser through Supabase Realtime
(`postgres_changes` on `messages`, filtered by the same access rules). Not built yet: blocking users, message
requests, deleting messages, read receipts.

## Notifications (phase 8)
Created only by database triggers on follows, likes, comments and messages; the browser can read its own and mark them
read, nothing else. Triggers skip your own actions, respect `user_settings.notify_*` (the toggles arrive in phase 11),
and remove the notification again when the action is undone (unlike, unfollow, deleted comment). Message
notifications are one per conversation until it is read. The bell in the header and the Notifications page update live
through Realtime. Posts now have their own page (`/p/<id>`), which notifications link to and phase 10 sharing will reuse.
Not built yet: grouping ("A and 5 others liked your post"), push notifications.

## XP and levels (phase 9)
XP is written only by database triggers (`xp_on_post/comment/like/follow`) through `award_xp()`. Rules and levels are data,
not code: edit `xp_rules` (amount, daily cap) and `levels` (name, tagline, requirements); add rows to `levels` to grow
from 10 to 15 or 20 levels. A level needs XP **and** posts **and** followers, and never goes down. Every award goes into
the append-only `xp_transactions` ledger; `profiles.xp_total` is the running sum. Anti-farming: daily caps per action,
one award per unique event (unique `dedupe_key`), no XP for your own content, 24-hour minimum account age for the
account whose like/comment/follow pays someone else, comments need 10+ characters. Streaks use UTC days. The XP
triggers swallow their own errors, so a bug in XP can never block posting, liking or following. The leaderboard has a
rolling weekly board and an all-time board. Not built yet: retroactive XP for older posts, detection of coordinated
like rings, admin tools to adjust XP (phase 12).

## Admin dashboard (built before phase 10)
Lives at `/admin` with its own layout. Access is an allow-list: only people in `admin_users` (added by running SQL in
Supabase, never from the app). Three layers: (1) every admin page and server action calls `requireAdmin()`, and anyone
else gets a plain 404; (2) every `admin_*` database function calls `assert_admin()` itself, so calling it directly with
a normal account fails; (3) the area is excluded from search engines. Suspending a user sets `profiles.status` and
`auth.users.banned_until`, so they cannot sign in or use the app; admins cannot suspend themselves or other admins.
Everything an admin changes is recorded in `admin_actions` with a reason. Passwords and hashes are never read or shown.
Not built yet: a user-reporting queue (needs a "Report" button first), two-factor authentication for admin sign-in,
a full login history (only the latest sign-in per user is shown), and deleting the stored image files of removed posts.

## Sharing (phase 10)
A share is a row in `posts` with `is_share = true` and `shared_post_id` pointing at the original, so it can always be
traced back and the original author is credited. Created only through `share_post()`: you cannot share your own post,
can share each original once, and sharing a share shares the original. If the original is deleted the share shows "no
longer available". Share counts are kept by a trigger. The original author gets a notification and XP (`post_shared`,
from accounts older than 24 hours); a share does not count as a new post for XP or level requirements. Outside the app,
"Copy link" and the phone's own share sheet ("Share via...", where the browser supports it) send a link to the ORIGINAL
post at `/p/<id>`. Known limit: that page needs a PulseHive sign-in, so people without an account see the login page;
public preview pages (with social previews) can be added later.

## Settings and privacy (phase 11)
`/settings` holds appearance, notifications, privacy, account and sign out; `/privacy` is the public Privacy Policy.
Theme is saved to `user_settings.theme` (so it follows you across devices) and cached in `localStorage`; a tiny inline
script in `<head>` applies it before first paint. Every privacy control is enforced in the database: message permission
(`start_conversation` and the message trigger), discoverability (`search_profiles`, `suggested_accounts`) and leaderboard
visibility (leaderboard functions). Notification toggles feed the existing triggers. Settings are changed through one
allow-listed server action. Account: email change (confirmation email), password change (re-checks the current
password), data export (`/settings/export`, your own rows only) and account deletion (`delete_my_account()` removes the
sign-in, which cascades to everything you created; admins are protected). Not built yet: private accounts with follower
approval, blocking and muting people, two-factor sign-in. The privacy policy is a plain-language draft: confirm the
minimum age and contact details for your country and have it reviewed before launch. Optional env var
`NEXT_PUBLIC_CONTACT_EMAIL` shows a contact address on the policy page.
