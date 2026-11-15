import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';

export const metadata: Metadata = { title: 'Terms of Service' };

const UPDATED = 'November 14, 2026';
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

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Wordmark className="!text-2xl" />
        <Link href="/" className="btn-ghost">
          Back to PulseHive
        </Link>
      </div>

      <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {UPDATED}</p>
      <p className="mt-4 leading-relaxed">
        These are the rules for using PulseHive. By creating an account or using PulseHive, you agree to them and to our{' '}
        <Link href="/privacy" className="font-semibold text-brand">
          Privacy Policy
        </Link>
        . If you do not agree, please do not use PulseHive.
      </p>

      <Section title="1. Who can use PulseHive">
        <List
          items={[
            'You must be at least 13 years old.',
            'You must give accurate information when you sign up, and keep your sign-in details to yourself.',
            'You are responsible for what happens on your account. Tell us quickly if you think someone else is using it.',
            'One person, one account. Please do not create accounts to get around a suspension or to gain XP.',
          ]}
        />
      </Section>

      <Section title="2. Your content">
        <p>
          You own what you post (text, photos, comments and messages). By posting on PulseHive you give us permission to store it,
          display it to other members, and share it inside PulseHive as you choose (for example when someone shares your post). This
          permission ends when you delete the content or your account, except for copies other members have already shared or that
          remain in short-term backups.
        </p>
        <p>You promise that you have the right to post what you post, and that it does not break these rules or the law.</p>
      </Section>

      <Section title="3. What is not allowed">
        <List
          items={[
            'Harassment, bullying, threats, or hate directed at people or groups.',
            'Sexual content involving minors (this is never allowed and will be reported), or sexually explicit content.',
            'Violence, or content that encourages self-harm or illegal activity.',
            'Scams, fraud, impersonating someone else, or spreading malware or harmful links.',
            'Spam, fake engagement, buying or selling likes, follows or XP, and using bots or scripts to act on the site.',
            'Trying to break, overload or get around PulseHive, including trying to see data you are not allowed to see, or to change XP, levels or counts.',
            'Sharing other people\'s private information without their permission.',
            'Posting content that infringes someone else\'s copyright or other rights.',
          ]}
        />
      </Section>

      <Section title="4. XP, levels and the leaderboard">
        <p>
          XP and levels are awarded automatically for genuine activity. We may remove XP, adjust levels or remove you from the
          leaderboard if we find that they were gained through spam, fake accounts, coordinated engagement or other manipulation. We
          may change how XP and levels work over time.
        </p>
      </Section>

      <Section title="5. Messages">
        <p>
          Private messages are between you and the person you message. Please be respectful. You can choose who may message you in
          Settings. Messages are not end-to-end encrypted, and we may review reported messages or content when needed to keep members safe or to follow the law.
        </p>
      </Section>

      <Section title="6. Reports and moderation">
        <p>
          Members can report posts, comments and accounts. Administrators review reports and may remove content, suspend or deactivate
          accounts, or take other action when the rules are broken. We try to be fair, but we do not have to give advance notice, and our decisions on
          moderation are final within PulseHive.
        </p>
      </Section>

      <Section title="7. Ending your account">
        <List
          items={[
            'You can delete your account at any time in Settings. This permanently removes your account and content as described in the Privacy Policy.',
            'We may suspend or remove accounts that break these rules, put others at risk, or are used illegally.',
          ]}
        />
      </Section>

      <Section title="8. PulseHive is provided as it is">
        <p>
          We work hard to keep PulseHive running and safe, but we cannot promise it will always be available, error-free or secure.
          PulseHive is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not responsible for losses that come from using PulseHive,
          from content posted by members, or from things outside our control. Nothing in these terms limits rights you have by law that cannot be limited.
        </p>
      </Section>

      <Section title="9. Changes to these terms">
        <p>
          We may update these terms. We will change the date at the top, and tell members in the app if the changes are important.
          Using PulseHive after a change means you accept it.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          {CONTACT ? (
            <>
              Questions about these terms: <a href={`mailto:${CONTACT}`} className="font-semibold text-brand">{CONTACT}</a>.
            </>
          ) : (
            'Questions about these terms can be sent to the PulseHive team through the app.'
          )}
        </p>
      </Section>
    </main>
  );
}
