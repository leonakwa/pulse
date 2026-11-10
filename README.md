# Pulse

An activity-driven social network: profiles, posts, follows, private messages, notifications, and XP with a leaderboard.
Web first (Next.js + Supabase), then an app. Design and roadmap: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Setup
1. Create a project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_foundation.sql`.
3. Supabase > Authentication > URL Configuration: set Site URL to your site, and add
   `http://localhost:3000/auth/callback` and `https://YOUR-VERCEL-URL/auth/callback` as Redirect URLs.
4. Copy `.env.example` to `.env.local` and add the project URL and anon key (Project Settings > API).
5. `npm install`, then `npm run dev`.
6. Deploy: import the repo into Vercel and add the same environment variables.

Never commit `.env.local`. The anon key is public by design; the service role key must never reach the browser.
Email confirmation is on by default: new users must click the email link before signing in.
