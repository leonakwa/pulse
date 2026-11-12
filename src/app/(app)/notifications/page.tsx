import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getNotificationsPage } from '@/lib/notifications';
import { NotificationList } from '@/components/NotificationList';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;

  const page = await getNotificationsPage(supabase, null);
  return <NotificationList userId={me.id} initialItems={page.items} initialCursor={page.nextCursor} />;
}
