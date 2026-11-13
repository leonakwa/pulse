import { createClient } from '@/lib/supabase/server';

const LIMIT = 5000;

// Downloads your own data as a JSON file. Everything is read with YOUR access, so you can only ever get your own rows.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const [profile, settings, posts, comments, likes, following, followers, xp, messages] = await Promise.all([
    supabase.from('profiles').select('username, full_name, bio, location, avatar_url, cover_url, level, xp_total, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('posts').select('id, body, is_share, shared_post_id, created_at, edited_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('post_comments').select('id, post_id, body, created_at').eq('author_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('post_likes').select('post_id, created_at').eq('user_id', user.id).limit(LIMIT),
    supabase.from('follows').select('following_id, created_at').eq('follower_id', user.id).limit(LIMIT),
    supabase.from('follows').select('follower_id, created_at').eq('following_id', user.id).limit(LIMIT),
    supabase.from('xp_transactions').select('reason, amount, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
    supabase.from('messages').select('conversation_id, body, created_at').eq('sender_id', user.id).order('created_at', { ascending: false }).limit(LIMIT),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    note: 'This file contains the information you created on Pulse. Messages are limited to the ones you sent.',
    account: { email: user.email, createdAt: user.created_at },
    profile: profile.data,
    settings: settings.data,
    posts: posts.data ?? [],
    comments: comments.data ?? [],
    likes: likes.data ?? [],
    following: following.data ?? [],
    followers: followers.data ?? [],
    xpHistory: xp.data ?? [],
    messagesSent: messages.data ?? [],
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="pulse-data.json"',
      'Cache-Control': 'no-store',
    },
  });
}
