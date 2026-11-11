import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ImagePicker } from '@/components/ImagePicker';
import { EditProfileForm } from './EditProfileForm';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, bio, location, avatar_url, cover_url')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) redirect('/feed');

  return (
    <section className="py-2">
      <Link href={`/u/${profile.username}`} className="text-sm font-medium text-muted hover:text-fg">
        ← Back to profile
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Edit profile</h1>

      <div className="mt-6 space-y-4">
        <p className="text-sm text-muted">Photos are saved as soon as you choose them.</p>
        <ImagePicker kind="cover" userId={user.id} name={profile.full_name} currentUrl={profile.cover_url} />
        <ImagePicker kind="avatar" userId={user.id} name={profile.full_name} currentUrl={profile.avatar_url} />
      </div>

      <div className="mt-8">
        <EditProfileForm
          values={{
            full_name: profile.full_name,
            username: profile.username,
            bio: profile.bio ?? '',
            location: profile.location ?? '',
          }}
        />
      </div>
    </section>
  );
}
