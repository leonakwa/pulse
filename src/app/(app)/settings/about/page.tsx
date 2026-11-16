import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getAbout } from '@/lib/about';
import { AboutEditor } from '@/components/settings/AboutEditor';
import { PlacesForm } from '@/components/settings/PlacesForm';

export const metadata: Metadata = { title: 'About' };

export default async function AboutSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user!;
  const [about, { data: profile }] = await Promise.all([
    getAbout(supabase, me.id),
    supabase.from('profiles').select('username').eq('id', me.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href={profile ? `/u/${profile.username}` : '/settings'} className="text-sm font-medium text-muted hover:text-fg">
          ← Back to profile
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold">About you</h1>
        <p className="mt-1 text-sm text-muted">
          Choose who can see each item: Public means other members of PulseHive, and Only me means just you. Adding your education and your work for the first time earns a little XP.
        </p>
      </div>

      <section>
        <h2 className="font-display text-lg font-bold">Places</h2>
        <div className="mt-3">
          <PlacesForm places={about.places} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Education</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Primary, secondary, college, university and more.</p>
        <AboutEditor kind="education" items={about.education} />
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Work</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Where you work or have worked.</p>
        <AboutEditor kind="work" items={about.work} />
      </section>
    </div>
  );
}
