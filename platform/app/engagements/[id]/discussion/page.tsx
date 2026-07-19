import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { addCommentAction } from "@/app/actions/comments";
import { AppNav } from "@/components/AppNav";
import { NavLink } from "@/components/NavLink";
import { Panel, PanelHeader, btnPrimary } from "@/components/ui/atlas";
import { SubmitButton } from "@/components/SubmitButton";
import { listComments, type CommentRow } from "@/lib/comments";
import { initials } from "@/lib/engagement-dashboard";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Discussion · AuditISA" };

function Thread({
  root,
  replies,
  engagementId,
  labels,
  input,
}: {
  root: CommentRow;
  replies: CommentRow[];
  engagementId: string;
  labels: { reply: string; replyPlaceholder: string };
  input: string;
}) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0" data-testid={`thread-${root.id}`}>
      <Bubble c={root} />
      {replies.map((r) => (
        <div key={r.id} className="mt-3 border-l-2 border-line pl-4 ml-4">
          <Bubble c={r} />
        </div>
      ))}
      <form action={addCommentAction} className="mt-3 ml-8 flex items-center gap-2">
        <input type="hidden" name="engagementId" value={engagementId} />
        <input type="hidden" name="parentId" value={root.id} />
        <input name="body" required placeholder={labels.replyPlaceholder} aria-label={labels.replyPlaceholder} className={`flex-1 ${input}`} data-testid={`reply-input-${root.id}`} />
        <SubmitButton className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-2 text-xs font-semibold text-ink-soft hover:bg-surface-2" testId={`reply-submit-${root.id}`}>{labels.reply}</SubmitButton>
      </form>
    </div>
  );
}

function Bubble({ c }: { c: CommentRow }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-extrabold tracking-wide text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" aria-hidden>
        {c.authorName ? initials(c.authorName) : "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-muted">
          <span className="font-semibold text-ink">{c.authorName ?? "—"}</span>
          <span className="tnum"> · {c.at}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">{c.body}</p>
      </div>
    </div>
  );
}

export default async function DiscussionPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tc = t.discussion;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const comments = await listComments(id);
  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (rootId: string) => comments.filter((c) => c.parentId === rootId);

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-4">
      <AppNav locale={locale} current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div>
        <NavLink
          href={`/engagements/${id}/dashboard`}
          className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          testId="back-to-dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          {t.dashboard.backToDashboard}
        </NavLink>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{tc.title}</h1>
        <p className="mt-1 text-[13px] text-ink-soft">{tc.subtitle}</p>
      </div>

      {error ? (
        <p data-testid="discussion-error" className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-[var(--color-rose-soft)] px-4 py-3 text-sm text-rose">
          {(tc.errors as Record<string, string>)[error] ?? error}
        </p>
      ) : null}

      <Panel className="p-5">
        <form action={addCommentAction} className="flex flex-col gap-3">
          <input type="hidden" name="engagementId" value={id} />
          <textarea name="body" required rows={3} placeholder={tc.placeholder} aria-label={tc.placeholder} className={input} data-testid="comment-input" />
          <SubmitButton className={`self-end ${btnPrimary}`} testId="comment-submit">{tc.post}</SubmitButton>
        </form>
      </Panel>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader title={tc.threads} right={<span className="text-xs font-semibold text-muted tnum">{roots.length}</span>} />
        </div>
        <div data-testid="discussion-list">
          {roots.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{tc.empty}</p>
          ) : (
            [...roots].reverse().map((root) => (
              <Thread
                key={root.id}
                root={root}
                replies={repliesOf(root.id)}
                engagementId={id}
                labels={{ reply: tc.reply, replyPlaceholder: tc.replyPlaceholder }}
                input={input}
              />
            ))
          )}
        </div>
      </Panel>
    </main>
  );
}
