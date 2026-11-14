import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, fmtDateTime } from '@/lib/admin';
import { deleteCommentAsAdmin, deletePostAsAdmin, resolveReport } from '@/lib/admin-actions';
import { reasonLabel } from '@/lib/reports';
import { ConfirmButton } from '@/components/admin/ConfirmButton';

export const metadata: Metadata = { title: 'Reports' };

const PER_PAGE = 15;

type Report = {
  id: string; created_at: string; target_type: string; reason: string; details: string | null; snapshot: string | null; status: string;
  reporter_username: string | null; target_user_id: string; target_username: string | null; target_full_name: string | null;
  post_id: string | null; comment_id: string | null; report_count: number; resolved_at: string | null;
  resolved_by_username: string | null; resolution_note: string | null;
};
type Props = { searchParams: Promise<{ status?: string; page?: string; done?: string; error?: string }> };

const TYPE_LABEL: Record<string, string> = { post: 'Post', comment: 'Comment', user: 'Account' };
const DONE_TEXT: Record<string, string> = { post: 'Post deleted.', comment: 'Comment deleted.', report: 'Report closed.' };

export default async function AdminReportsPage({ searchParams }: Props) {
  const { status: rawStatus, page: rawPage, done, error } = await searchParams;
  const status = rawStatus === 'closed' ? 'closed' : 'open';
  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);

  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc('admin_list_reports', { p_status: status, p_limit: PER_PAGE + 1, p_offset: (page - 1) * PER_PAGE });
  const rows = (data ?? []) as Report[];
  const hasNext = rows.length > PER_PAGE;
  const reports = rows.slice(0, PER_PAGE);

  const tab = (active: boolean) => `flex-1 border-b-2 py-3 text-center text-sm font-semibold ${active ? 'border-brand text-fg' : 'border-transparent text-muted'}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Reports</h1>
      <p className="text-sm text-muted">What members have reported. Deleting a post or comment here closes its reports for you.</p>

      <nav aria-label="Report status" className="-mx-4 mt-3 flex border-b border-line">
        <Link href="/admin/reports?status=open" className={tab(status === 'open')} aria-current={status === 'open' ? 'page' : undefined}>
          Open
        </Link>
        <Link href="/admin/reports?status=closed" className={tab(status === 'closed')} aria-current={status === 'closed' ? 'page' : undefined}>
          Closed
        </Link>
      </nav>

      {done ? <p role="status" className="mt-4 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{DONE_TEXT[done] ?? 'Done.'}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      {reports.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-10 text-center">
          <p className="font-semibold">{status === 'open' ? 'No open reports' : 'Nothing closed yet'}</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="rounded-full bg-danger/15 px-2 py-0.5 font-bold uppercase text-danger">{TYPE_LABEL[r.target_type] ?? r.target_type}</span>
                <span className="font-semibold">{reasonLabel(r.reason)}</span>
                {r.report_count > 1 ? <span className="font-semibold text-danger">· {r.report_count} reports on this</span> : null}
                <span className="text-muted">· {fmtDateTime(r.created_at)}</span>
              </div>

              <p className="mt-2 text-sm">
                About{' '}
                <Link href={`/admin/users/${r.target_user_id}`} className="font-semibold text-brand">
                  {r.target_full_name ?? 'unknown'} @{r.target_username ?? 'unknown'}
                </Link>
                <span className="text-muted"> · reported by @{r.reporter_username ?? 'a deleted account'}</span>
              </p>

              {r.snapshot ? <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-surface p-3 text-sm">{r.snapshot}</p> : null}
              {r.details ? <p className="mt-2 text-sm text-muted">Reporter said: {r.details}</p> : null}
              {r.post_id ? (
                <p className="mt-2 text-xs">
                  <Link href={`/p/${r.post_id}`} className="font-semibold text-brand">
                    Open the post
                  </Link>
                </p>
              ) : null}

              {r.status === 'open' ? (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {r.target_type === 'post' && r.post_id ? (
                    <form action={deletePostAsAdmin} className="flex gap-2">
                      <input type="hidden" name="postId" value={r.post_id} />
                      <input type="hidden" name="returnTo" value="/admin/reports" />
                      <label htmlFor={`dp-${r.id}`} className="sr-only">Reason for removing the post</label>
                      <input id={`dp-${r.id}`} name="reason" required minLength={3} maxLength={300} placeholder="Reason for removing the post" className="input !py-2" />
                      <ConfirmButton message="Delete this post permanently?" className="shrink-0 rounded-full border border-danger/50 px-4 text-sm font-semibold text-danger hover:bg-danger/10">
                        Delete post
                      </ConfirmButton>
                    </form>
                  ) : null}
                  {r.target_type === 'comment' && r.comment_id ? (
                    <form action={deleteCommentAsAdmin} className="flex gap-2">
                      <input type="hidden" name="commentId" value={r.comment_id} />
                      <input type="hidden" name="returnTo" value="/admin/reports" />
                      <label htmlFor={`dc-${r.id}`} className="sr-only">Reason for removing the comment</label>
                      <input id={`dc-${r.id}`} name="reason" required minLength={3} maxLength={300} placeholder="Reason for removing the comment" className="input !py-2" />
                      <ConfirmButton message="Delete this comment permanently?" className="shrink-0 rounded-full border border-danger/50 px-4 text-sm font-semibold text-danger hover:bg-danger/10">
                        Delete comment
                      </ConfirmButton>
                    </form>
                  ) : null}

                  <form action={resolveReport} className="flex flex-wrap gap-2">
                    <input type="hidden" name="reportId" value={r.id} />
                    <label htmlFor={`note-${r.id}`} className="sr-only">Note (optional)</label>
                    <input id={`note-${r.id}`} name="note" maxLength={300} placeholder="Note (optional)" className="input !py-2 min-w-[10rem] flex-1" />
                    <ConfirmButton name="decision" value="dismissed" message="Dismiss this report? Nothing was wrong." className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">
                      Dismiss
                    </ConfirmButton>
                    <ConfirmButton name="decision" value="actioned" message="Mark this report as dealt with?" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-fg">
                      Mark resolved
                    </ConfirmButton>
                  </form>
                  <p className="text-xs text-muted">To suspend the account, open the person above and use Manage account, then mark the report resolved.</p>
                </div>
              ) : (
                <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  <span className="font-semibold capitalize">{r.status}</span> by @{r.resolved_by_username ?? 'admin'} · {fmtDateTime(r.resolved_at)}
                  {r.resolution_note ? ` · ${r.resolution_note}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <div className="mt-4 flex justify-between text-sm font-semibold">
          {page > 1 ? <Link href={`/admin/reports?status=${status}&page=${page - 1}`} className="text-brand">Newer</Link> : <span />}
          {hasNext ? <Link href={`/admin/reports?status=${status}&page=${page + 1}`} className="text-brand">Older</Link> : <span />}
        </div>
      ) : null}
    </div>
  );
}
