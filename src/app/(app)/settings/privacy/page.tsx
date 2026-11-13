import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ChoiceGroup } from '@/components/settings/ChoiceGroup';
import { ToggleRow } from '@/components/settings/ToggleRow';

export const metadata: Metadata = { title: 'Privacy settings' };

const MESSAGE_OPTIONS = [
  { value: 'everyone', label: 'Everyone', hint: 'Anyone on Pulse can message you' },
  { value: 'following', label: 'People I follow', hint: 'Only people you follow can message you' },
  { value: 'nobody', label: 'No one', hint: 'Nobody can start or continue a chat with you' },
];

export default async function PrivacySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: s } = await supabase
    .from('user_settings')
    .select('message_permission, discoverable, show_on_leaderboard')
    .eq('user_id', user!.id)
    .maybeSingle();

  return (
    <div>
      <Link href="/settings" className="text-sm font-medium text-muted hover:text-fg">
        ← Settings
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Privacy</h1>
      <p className="mt-1 text-sm text-muted">Changes save straight away and are enforced by Pulse's database.</p>

      <div className="mt-4 divide-y divide-line">
        <ChoiceGroup settingKey="message_permission" legend="Who can message me" options={MESSAGE_OPTIONS} initial={s?.message_permission ?? 'everyone'} />
        <ToggleRow
          settingKey="discoverable"
          label="Show me in search and suggestions"
          description="When off, people can still open your profile if they have the link"
          initial={s ? s.discoverable !== false : true}
        />
        <ToggleRow
          settingKey="show_on_leaderboard"
          label="Show me on the leaderboard"
          description="You keep earning XP and levels either way"
          initial={s ? s.show_on_leaderboard !== false : true}
        />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          Download a copy of your profile, settings, posts, comments, likes, follows, XP history and the messages you sent, as a file.
        </p>
        <a href="/settings/export" download className="mt-3 inline-block rounded-full border border-line px-5 py-2 text-sm font-semibold hover:border-brand">
          Download my data
        </a>
        <p className="mt-4 text-sm text-muted">
          Posts on Pulse are visible to signed-in members. Private accounts with follower approval are not available yet.
        </p>
      </section>

      <p className="mt-6 text-sm">
        <Link href="/privacy" className="font-semibold text-brand">
          Read the Privacy Policy
        </Link>
      </p>
    </div>
  );
}
