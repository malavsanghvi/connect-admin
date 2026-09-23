import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, LoadProblem, NoAccess, PageHeader } from "@/components/ui";
import { can, hasRole } from "@/lib/access";
import { resolvePeopleNames, resolveUserNames } from "@/lib/data/people";
import { formatDateTime, humanize } from "@/lib/format";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { replyToThread, setThread } from "../../actions";

export const metadata: Metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!can(v.access, "comms.inbox") && !hasRole(v.access, "zone_lead")) return <NoAccess area="inboxes" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const res = await load(async () => {
    const t = row(await supabase.from("threads").select("*").eq("id", id).maybeSingle(), "the conversation");
    if (!t) return null;
    const [inbox, messages] = await Promise.all([
      supabase.from("inboxes").select("name").eq("id", t.inbox_id).maybeSingle(),
      supabase.from("thread_messages").select("*").eq("thread_id", id).order("created_at"),
    ]);
    const m = rows(messages, "messages");
    const [people, users] = await Promise.all([
      resolvePeopleNames(supabase, [t.from_person_id]),
      resolveUserNames(supabase, v.center.id, [...m.map((x) => x.author_user), t.assignee_user]),
    ]);
    return { t, inbox: row(inbox, "the inbox"), messages: m, people, users };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { t, inbox, messages, people, users } = res.data;
  const from = t.from_person_id ? (people.get(t.from_person_id) ?? "Member") : (t.from_guest_contact ?? "Guest");

  return (
    <>
      <PageHeader
        title={t.subject ?? "(no subject)"}
        back={{ href: `/comms?tab=inbox&inbox=${t.inbox_id}`, label: inbox?.name ?? "Inbox" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={t.status === "closed" ? "muted" : "navy"}>{humanize(t.status)}</Badge>
            From {from} · {formatDateTime(t.created_at, tz)} · {t.assignee_user ? `assigned to ${t.assignee_user === v.userId ? "you" : (users.get(t.assignee_user) ?? "a colleague")}` : "unassigned"}
          </span>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {t.assignee_user !== v.userId && <ActionButton action={setThread.bind(null, t.id)} fields={{ do: "assign_me" }} label="Assign to me" />}
        {t.assignee_user && <ActionButton action={setThread.bind(null, t.id)} fields={{ do: "unassign" }} label="Unassign" />}
        {t.status !== "closed" ? (
          <ActionButton action={setThread.bind(null, t.id)} fields={{ do: "close" }} label="Close" className="btn btn-danger" />
        ) : (
          <ActionButton action={setThread.bind(null, t.id)} fields={{ do: "reopen" }} label="Reopen" />
        )}
      </div>
      <Card>
        <ol className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${m.from_role ? "ml-auto bg-navy-soft" : "bg-sand"}`}>
              <p className="whitespace-pre-line">{m.body}</p>
              <p className="mt-1 text-xs text-muted">
                {m.from_role ? `${inbox?.name ?? "Inbox"}${m.author_user ? ` (${m.author_user === v.userId ? "you" : (users.get(m.author_user) ?? "staff")})` : ""}` : from} ·{" "}
                {formatDateTime(m.created_at, tz)}
              </p>
            </li>
          ))}
          {messages.length === 0 && <li className="text-sm text-muted">No messages.</li>}
        </ol>
        <div className="mt-4 border-t border-line pt-4">
          <ActionForm action={replyToThread.bind(null, t.id)} submitLabel="Send reply" resetOnSuccess>
            <textarea name="body" rows={4} required className="field-input" aria-label="Reply" placeholder="Replies go out from the inbox, never your personal number." />
            <Checkbox name="close" label="Close the conversation after replying" />
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
