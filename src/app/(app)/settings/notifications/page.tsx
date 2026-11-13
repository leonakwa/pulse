import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ToggleRow } from '@/components/settings/ToggleRow';

export const metadata: Metadata = { title: 'Notification settings' };

const ROWS = [
  { key: 'notify_follows', label: 'New followers', description: 'When someone follows you' },
  { key: 'notify_likes', label: 'Likes', description: 'When someone likes your post' },
  { key: 'notify_comments', label: 'Comments', description: 'When someone comments on your post' },
  { key: 'notify_shares', label: 'Shares', description: 'When someone shares your post' },
  { key: 'notify_messages', label: 'Messages', description: 'When someone sends you a message' },
];

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: s } = await supabase
    .from('user_settings')
    .select('notify_follows, notify_likes, notify_comments, notify_shares, notify_messages')
    .eq('user_id', user!.id)
    .maybeSingle();

  const values = (s ?? {}) as Record<string, boolean | null | undefined>;

  return (
    <div>
      <Link href="/settings" className="text-sm font-medium text-muted hover:text-fg">
        ← Settings
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-muted">Changes save straight away. Level-up messages are always on.</p>
      <div className="mt-4 divide-y divide-line">
        {ROWS.map((r) => (
          <ToggleRow key={r.key} settingKey={r.key} label={r.label} description={r.description} initial={values[r.key] !== false} />
        ))}
      </div>
    </div>
  );
}
