'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAboutItem, saveEducation, saveWork } from '@/lib/about-actions';
import { EDUCATION_KINDS, VISIBILITY, kindLabel, yearsLabel, type EducationItem, type WorkItem } from '@/lib/about';
import { initialFormState } from '@/lib/form-state';
import { FormMessage, SubmitButton } from '@/components/FormBits';

type Kind = 'education' | 'work';
type Item = EducationItem | WorkItem;

function isEducation(item: Item): item is EducationItem {
  return 'school_name' in item;
}

function Years({ start, end, current, label }: { start: number | null; end: number | null; current: boolean; label: string }) {
  const [isCurrent, setIsCurrent] = useState(current);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="start_year" className="label">
            Start year
          </label>
          <input id="start_year" name="start_year" type="number" inputMode="numeric" min={1900} max={2100} defaultValue={start ?? ''} placeholder="2016" className="input" />
        </div>
        <div>
          <label htmlFor="end_year" className="label">
            End year
          </label>
          <input id="end_year" name="end_year" type="number" inputMode="numeric" min={1900} max={2100} defaultValue={end ?? ''} disabled={isCurrent} placeholder="2021" className="input disabled:opacity-50" />
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_current" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
        {label}
      </label>
    </div>
  );
}

function ItemForm({ kind, item, onDone, onCancel }: { kind: Kind; item: Item | null; onDone: () => void; onCancel: () => void }) {
  const [state, formAction] = useActionState(kind === 'education' ? saveEducation : saveWork, initialFormState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const edu = item && isEducation(item) ? item : null;
  const job = item && !isEducation(item) ? item : null;

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-line p-4" noValidate>
      <FormMessage state={state} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      {kind === 'education' ? (
        <>
          <div>
            <label htmlFor="school_name" className="label">
              School
            </label>
            <input id="school_name" name="school_name" defaultValue={edu?.school_name ?? ''} maxLength={100} required className="input" />
          </div>
          <div>
            <label htmlFor="kind" className="label">
              Type
            </label>
            <select id="kind" name="kind" defaultValue={edu?.kind ?? 'secondary'} className="input">
              {EDUCATION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="field_of_study" className="label">
              Field of study <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="field_of_study" name="field_of_study" defaultValue={edu?.field_of_study ?? ''} maxLength={100} className="input" />
          </div>
          <Years start={edu?.start_year ?? null} end={edu?.end_year ?? null} current={edu?.is_current ?? false} label="I study here now" />
        </>
      ) : (
        <>
          <div>
            <label htmlFor="company" className="label">
              Company or place of work
            </label>
            <input id="company" name="company" defaultValue={job?.company ?? ''} maxLength={100} required className="input" />
          </div>
          <div>
            <label htmlFor="position" className="label">
              Position <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="position" name="position" defaultValue={job?.position ?? ''} maxLength={100} className="input" />
          </div>
          <div>
            <label htmlFor="location" className="label">
              Location <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="location" name="location" defaultValue={job?.location ?? ''} maxLength={100} className="input" />
          </div>
          <Years start={job?.start_year ?? null} end={job?.end_year ?? null} current={job?.is_current ?? false} label="I work here now" />
        </>
      )}

      <div>
        <label htmlFor="description" className="label">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="description" name="description" defaultValue={item?.description ?? ''} maxLength={300} rows={2} className="input resize-none" />
      </div>
      <div>
        <label htmlFor="visibility" className="label">
          Who can see this
        </label>
        <select id="visibility" name="visibility" defaultValue={item?.visibility ?? 'public'} className="input">
          {VISIBILITY.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <button type="button" onClick={onCancel} className="w-full py-1 text-sm font-semibold text-muted hover:text-fg">
        Cancel
      </button>
    </form>
  );
}

export function AboutEditor({ kind, items }: { kind: Kind; items: Item[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (!window.confirm('Remove this?')) return;
    setError(null);
    const res = await deleteAboutItem(kind, id);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div>
      {items.length === 0 && editing !== 'new' ? <p className="text-sm text-muted">Nothing added yet.</p> : null}

      <ul className="space-y-3">
        {items.map((item) =>
          editing === item.id ? (
            <li key={item.id}>
              <ItemForm kind={kind} item={item} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={item.id} className="rounded-2xl border border-line p-3">
              {isEducation(item) ? (
                <>
                  <p className="font-semibold">{item.school_name}</p>
                  <p className="text-sm text-muted">
                    {[kindLabel(item.kind), item.field_of_study, yearsLabel(item.start_year, item.end_year, item.is_current)].filter(Boolean).join(' · ')}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{item.position ? `${item.position} at ${item.company}` : item.company}</p>
                  <p className="text-sm text-muted">{[item.location, yearsLabel(item.start_year, item.end_year, item.is_current)].filter(Boolean).join(' · ')}</p>
                </>
              )}
              <p className="mt-1 text-xs text-muted">{item.visibility === 'only_me' ? 'Only you can see this' : 'Public'}</p>
              <div className="mt-2 flex gap-4 text-sm font-semibold">
                <button type="button" onClick={() => setEditing(item.id)} className="text-brand">
                  Edit
                </button>
                <button type="button" onClick={() => void remove(item.id)} className="text-muted hover:text-danger">
                  Remove
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      {editing === 'new' ? (
        <div className="mt-3">
          <ItemForm kind={kind} item={null} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('new')} disabled={items.length >= 10} className="mt-3 rounded-full border border-line px-5 py-2 text-sm font-semibold hover:border-brand disabled:opacity-60">
          {kind === 'education' ? 'Add education' : 'Add work'}
        </button>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
