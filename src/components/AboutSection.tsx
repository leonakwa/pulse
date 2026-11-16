import Link from 'next/link';
import { kindLabel, yearsLabel, type About } from '@/lib/about';

const OnlyMe = () => <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Only you</span>;

export function AboutSection({ about, isOwn }: { about: About; isOwn: boolean }) {
  const { education, work, places } = about;
  const empty = education.length === 0 && work.length === 0 && !places?.current_city && !places?.hometown;

  if (empty && !isOwn) return null;

  return (
    <section className="mt-6 rounded-2xl border border-line p-4" aria-labelledby="about-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="about-heading" className="font-display text-lg font-bold">
          About
        </h2>
        {isOwn ? (
          <Link href="/settings/about" className="text-sm font-semibold text-brand">
            {empty ? 'Add' : 'Edit'}
          </Link>
        ) : null}
      </div>

      {empty ? (
        <p className="mt-2 text-sm text-muted">Add the schools you went to, where you work, and where you live. It helps people find and know you.</p>
      ) : null}

      {places && (places.current_city || places.hometown) ? (
        <ul className="mt-3 space-y-1 text-sm">
          {places.current_city ? (
            <li>
              Lives in <span className="font-semibold">{places.current_city}</span>
              {isOwn && places.visibility === 'only_me' ? <OnlyMe /> : null}
            </li>
          ) : null}
          {places.hometown ? (
            <li>
              From <span className="font-semibold">{places.hometown}</span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {education.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Education</h3>
          <ul className="mt-2 space-y-3">
            {education.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-semibold">
                  {e.school_name}
                  {isOwn && e.visibility === 'only_me' ? <OnlyMe /> : null}
                </p>
                <p className="text-muted">
                  {[kindLabel(e.kind), e.field_of_study, yearsLabel(e.start_year, e.end_year, e.is_current)].filter(Boolean).join(' · ')}
                </p>
                {e.description ? <p className="mt-0.5 whitespace-pre-line">{e.description}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {work.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Work</h3>
          <ul className="mt-2 space-y-3">
            {work.map((w) => (
              <li key={w.id} className="text-sm">
                <p className="font-semibold">
                  {w.position ? `${w.position} at ${w.company}` : w.company}
                  {isOwn && w.visibility === 'only_me' ? <OnlyMe /> : null}
                </p>
                <p className="text-muted">{[w.location, yearsLabel(w.start_year, w.end_year, w.is_current)].filter(Boolean).join(' · ')}</p>
                {w.description ? <p className="mt-0.5 whitespace-pre-line">{w.description}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
