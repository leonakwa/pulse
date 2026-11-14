import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';

export const metadata: Metadata = { title: 'Privacy Policy' };

const UPDATED = 'November 13, 2026';
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Wordmark className="!text-2xl" />
        <Link href="/" className="btn-ghost">
          Back to PulseHive
        </Link>
      </div>

      <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {UPDATED}</p>
      <p className="mt-4 leading-relaxed">
        This page explains, in plain language, what information PulseHive collects, how it is stored and used, who can see it, how it is
        protected, and the choices you have.
      </p>

      <Section title="1. What we collect">
        <p>Information you give us:</p>
        <List
          items={[
            'Your email address and password (your password is handled by our sign-in system and is never stored or visible to us in readable form).',
            'Your profile: name, username, bio, location (optional), profile picture and cover photo.',
            'What you create: posts, photos, comments, likes, shares and follows.',
            'Private messages you send and receive.',
            'Your settings and preferences, such as theme, notification choices and privacy choices.',
          ]}
        />
        <p>Information created as you use PulseHive:</p>
        <List
          items={[
            'Activity records: when you last signed in, which days you were active (for streaks), and your XP, level and XP history.',
            'Notifications we send you inside the app.',
            'A sign-in session cookie that keeps you logged in, and a small browser setting that remembers your theme.',
          ]}
        />
        <p>We do not sell your information, show advertising, or use third-party advertising or tracking tools.</p>
      </Section>

      <Section title="2. How we use it">
        <List
          items={[
            'To run PulseHive: show your profile and posts, deliver messages, count likes and comments, and send notifications.',
            'To run XP, levels, streaks and leaderboards, which are calculated automatically from real activity.',
            'To keep PulseHive safe: preventing spam and abuse, limiting how fast actions can be repeated, and investigating problems.',
            'To moderate: administrators can review accounts and posts and suspend accounts that break the rules.',
          ]}
        />
      </Section>

      <Section title="3. Who can see what">
        <List
          items={[
            'Your profile, posts, comments, likes, level and XP can be seen by other signed-in members of PulseHive. They are not shown to the public web.',
            'Your private messages can be read only by you and the person you are chatting with. They are not end-to-end encrypted.',
            'Your email address can be seen only by you and PulseHive administrators.',
            'PulseHive administrators can see account details (such as email, join date and last sign-in), posts, and moderation history. The admin dashboard does not display message contents, passwords or password hashes. Technical administrators of our database and hosting providers can access stored data as needed to run the service.',
          ]}
        />
      </Section>

      <Section title="4. Where it is stored">
        <p>
          PulseHive uses trusted service providers to operate: a database, sign-in and file-storage provider (Supabase) and a hosting
          provider (Vercel). Your information is processed and stored on their systems, which may be in other countries.
        </p>
      </Section>

      <Section title="5. How we protect it">
        <List
          items={[
            'Passwords are stored only as secure one-way hashes by our sign-in system.',
            'All traffic uses encrypted connections (HTTPS).',
            'Access rules inside the database decide who can read or change each piece of information, so people can only reach what they are allowed to.',
            'XP and levels can only be awarded by the system, not edited by users.',
            'Administrator access is restricted to approved accounts, and administrator actions are recorded.',
            'No system is perfectly secure, so we cannot guarantee absolute security.',
          ]}
        />
      </Section>

      <Section title="6. Your choices">
        <List
          items={[
            'Edit your profile and photos at any time in Settings.',
            'Choose who can message you, whether you appear in search and suggestions, and whether you appear on the leaderboard.',
            'Turn notifications on or off by type.',
            'Download a copy of your data from Settings, Privacy.',
            'Delete your account from Settings, Account. This permanently removes your account, profile, posts, comments, likes, follows, XP, notifications and the messages you sent, and removes your photos. Shares of your posts by others will show as no longer available. Our providers may keep short-lived backup copies for a limited time.',
          ]}
        />
      </Section>

      <Section title="7. How long we keep it">
        <p>
          We keep your information while your account exists. When you delete your account, it is removed as described above. If an
          administrator removes a post, it is deleted and the removal is recorded in the administrator log.
        </p>
      </Section>

      <Section title="8. Age">
        <p>PulseHive is for people aged 13 and over. If you believe a younger child has created an account, please contact us so we can remove it.</p>
      </Section>

      <Section title="9. Changes to this policy">
        <p>If we change this policy, we will update the date at the top. If the changes are important, we will tell members in the app.</p>
      </Section>

      <Section title="10. Contact">
        <p>
          {CONTACT ? (
            <>
              Questions or requests about your information: <a href={`mailto:${CONTACT}`} className="font-semibold text-brand">{CONTACT}</a>.
            </>
          ) : (
            'Questions or requests about your information can be sent to the PulseHive team through the app.'
          )}
        </p>
      </Section>
    </main>
  );
}
