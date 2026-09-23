import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, Select, TableWrap, Tabs, td, th } from "@/components/ui";
import { can, hasRole, zoneLeadZoneIds } from "@/lib/access";
import { resolvePeopleNames } from "@/lib/data/people";
import { formatDateTime, humanize } from "@/lib/format";
import { describeAudience } from "@/lib/logic/audience";
import type { Tables } from "@/lib/database.types";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { createAlert, endAlert, handleJoinRequest, saveSurvey } from "./actions";
import { AudienceFields } from "./audience-fields";
import { QuestionsBuilder } from "./questions-builder";
import { CampaignForm, loadAudienceOptions } from "./shared";

export const metadata: Metadata = { title: "Communications" };

const STATUS_TONE = { draft: "muted", pending_approval: "warning", scheduled: "navy", sending: "navy", sent: "success", cancelled: "danger" } as const;

export default async function CommsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  const staff = can(v.access, "comms.view", "comms.send");
  const inboxAccess = can(v.access, "comms.inbox") || hasRole(v.access, "zone_lead");
  if (!staff && !inboxAccess) return <NoAccess area="communications" />;
  const sp = await searchParams;
  const tabs = [
    ...(staff ? [{ key: "campaigns", label: "Announcements" }] : []),
    ...(inboxAccess ? [{ key: "inbox", label: "Inboxes" }] : []),
    ...(staff ? [{ key: "whatsapp", label: "WhatsApp queue" }, { key: "surveys", label: "Surveys" }, { key: "alerts", label: "Alerts" }] : []),
  ];
  const tab = tabs.some((t) => t.key === sp.tab) ? String(sp.tab) : tabs[0].key;
  const inboxId = typeof sp.inbox === "string" ? sp.inbox : null;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const canSend = can(v.access, "comms.send");

  const res = await load(async (): Promise<Payload> => {
    const options = tab === "campaigns" || tab === "surveys" || tab === "alerts" ? await loadAudienceOptions(supabase, v.center.id) : { zones: [], classes: [], events: [] };
    if (tab === "campaigns") {
      return { kind: "campaigns", options, campaigns: rows(await supabase.from("comms_campaigns").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }).limit(100), "messages") };
    }
    if (tab === "inbox") {
      let inboxes = rows(await supabase.from("inboxes").select("*").eq("center_id", v.center.id).order("name"), "inboxes");
      if (!can(v.access, "comms.inbox")) {
        const zones = new Set(zoneLeadZoneIds(v.access));
        inboxes = inboxes.filter((i) => i.zone_id && zones.has(i.zone_id));
      }
      const threads = rows(
        await supabase
          .from("threads")
          .select("*")
          .eq("center_id", v.center.id)
          .in("inbox_id", inboxes.map((i) => i.id).concat(["00000000-0000-0000-0000-000000000000"]))
          .order("created_at", { ascending: false })
          .limit(300),
        "conversations",
      );
      const names = await resolvePeopleNames(supabase, threads.map((t) => t.from_person_id));
      return { kind: "inbox", options, inboxes, threads, names };
    }
    if (tab === "whatsapp") {
      const [requests, groups] = await Promise.all([
        supabase.from("whatsapp_join_requests").select("*").eq("center_id", v.center.id).in("status", ["pending", "approved"]).order("created_at"),
        supabase.from("whatsapp_groups").select("id, name").eq("center_id", v.center.id),
      ]);
      const r = rows(requests, "join requests");
      return { kind: "whatsapp", options, requests: r, groups: rows(groups, "WhatsApp groups"), names: await resolvePeopleNames(supabase, r.map((x) => x.person_id)) };
    }
    if (tab === "surveys") {
      const surveys = rows(await supabase.from("surveys").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }), "surveys");
      const responses = surveys.length ? rows(await supabase.from("survey_responses").select("survey_id").in("survey_id", surveys.map((s) => s.id)), "responses") : [];
      return { kind: "surveys", options, surveys, responses };
    }
    return { kind: "alerts", options, alerts: rows(await supabase.from("alerts").select("*").eq("center_id", v.center.id).order("starts_at", { ascending: false }).limit(50), "alerts") };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data;
  const names = { zones: new Map(d.options.zones.map((z) => [z.id, z.name])), classes: new Map(d.options.classes.map((c) => [c.id, c.name])), events: new Map(d.options.events.map((e) => [e.id, e.name])) };

  return (
    <>
      <PageHeader title="Communications" description="Announcements and newsletters, role inboxes, WhatsApp join requests, surveys and alerts." />
      <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/comms?tab=${t.key}` }))} />

      {d.kind === "campaigns" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {d.campaigns.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              <ul className="space-y-3">
                {d.campaigns.map((c) => (
                  <li key={c.id}>
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[c.status as keyof typeof STATUS_TONE] ?? "muted"}>
                          {c.status === "pending_approval" ? "Waiting for a second approver" : humanize(c.status)}
                        </Badge>
                        <Badge tone="neutral">{humanize(c.kind)}</Badge>
                      </div>
                      <Link href={`/comms/campaigns/${c.id}`} className="mt-2 block font-display text-lg font-semibold text-navy hover:underline">
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {describeAudience(c.audience, names)} · {c.channels.map(humanize).join(", ")}
                        {c.scheduled_at ? ` · ${c.status === "sent" ? "sent" : "sends"} ${formatDateTime(c.sent_at ?? c.scheduled_at, tz)}` : ""}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lg:col-span-2">
            {canSend ? (
              <Card title="New message">
                <CampaignForm campaign={null} options={d.options} tz={tz} />
              </Card>
            ) : (
              <p className="text-sm text-muted">Your role can view messages but not compose them.</p>
            )}
          </div>
        </div>
      )}

      {d.kind === "inbox" && (
        <InboxTab
          inboxes={d.inboxes}
          threads={d.threads}
          names={d.names}
          inboxId={inboxId}
          tz={tz}
          me={v.userId}
        />
      )}

      {d.kind === "whatsapp" && (
        <Card title="Join requests" description="Approve, add the member in WhatsApp, then mark them added.">
          {d.requests.length === 0 ? (
            <EmptyState title="No pending requests" />
          ) : (
            <TableWrap>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={th}>Member</th>
                    <th className={th}>Group</th>
                    <th className={th}>Phone</th>
                    <th className={th}>Status</th>
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {d.requests.map((r) => (
                    <tr key={r.id}>
                      <td className={td}>{d.names.get(r.person_id) ?? "Member"}</td>
                      <td className={td}>{d.groups.find((g) => g.id === r.group_id)?.name ?? "Group"}</td>
                      <td className={td}>{r.phone_e164}</td>
                      <td className={td}>
                        <Badge tone={r.status === "approved" ? "navy" : "warning"}>{humanize(r.status)}</Badge>
                      </td>
                      <td className={td}>
                        {canSend && (
                          <div className="flex flex-wrap gap-2">
                            {r.status === "pending" && <ActionButton action={handleJoinRequest.bind(null, r.id)} fields={{ status: "approved" }} label="Approve" />}
                            <ActionButton action={handleJoinRequest.bind(null, r.id)} fields={{ status: "added" }} label="Mark added" className="btn btn-success" />
                            <ActionButton action={handleJoinRequest.bind(null, r.id)} fields={{ status: "declined" }} label="Decline" className="btn btn-danger" confirm="Decline this request?" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}

      {d.kind === "surveys" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {d.surveys.length === 0 ? (
              <EmptyState title="No surveys yet" />
            ) : (
              <ul className="space-y-3">
                {d.surveys.map((s) => (
                  <li key={s.id}>
                    <Card>
                      <Badge tone={s.status === "open" ? "success" : s.status === "closed" ? "neutral" : "muted"}>{humanize(s.status)}</Badge>
                      <Link href={`/comms/surveys/${s.id}`} className="mt-2 block font-semibold text-navy hover:underline">
                        {s.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {d.responses.filter((r) => r.survey_id === s.id).length} responses{s.anonymous ? " · anonymous" : ""}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lg:col-span-3">
            {canSend && (
              <Card title="New survey">
                <ActionForm action={saveSurvey.bind(null, null)} submitLabel="Create survey">
                  <div className="space-y-4">
                    <Field label="Title">
                      <input name="title" required className="field-input" />
                    </Field>
                    <Field label="Intro">
                      <textarea name="description" rows={2} className="field-input" />
                    </Field>
                    <QuestionsBuilder initial={[]} />
                    <FormGrid>
                      <Field label="Opens">
                        <input type="datetime-local" name="opens_at" className="field-input" />
                      </Field>
                      <Field label="Closes">
                        <input type="datetime-local" name="closes_at" className="field-input" />
                      </Field>
                    </FormGrid>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" name="anonymous" className="h-5 w-5 accent-navy" /> Anonymous answers (no names stored)
                    </label>
                    <AudienceFields zones={d.options.zones} classes={d.options.classes} events={d.options.events} initial={{ all_members: true }} />
                  </div>
                </ActionForm>
              </Card>
            )}
          </div>
        </div>
      )}

      {d.kind === "alerts" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {d.alerts.length === 0 ? (
              <EmptyState title="No alerts" />
            ) : (
              <ul className="space-y-3">
                {d.alerts.map((a) => {
                  const live = !a.ends_at || a.ends_at > new Date().toISOString();
                  return (
                    <li key={a.id}>
                      <Card>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={a.severity === "urgent" ? "danger" : a.severity === "important" ? "warning" : "navy"}>{humanize(a.severity)}</Badge>
                          {live ? <Badge tone="success">Showing</Badge> : <Badge tone="muted">Ended</Badge>}
                        </div>
                        <p className="mt-2 font-semibold">{a.title}</p>
                        <p className="text-sm">{a.body}</p>
                        <p className="mt-1 text-xs text-muted">
                          {describeAudience(a.audience, names)} · {formatDateTime(a.starts_at, tz)}
                          {a.ends_at ? ` → ${formatDateTime(a.ends_at, tz)}` : ""}
                        </p>
                        {live && canSend && (
                          <div className="mt-2">
                            <ActionButton action={endAlert.bind(null, a.id)} label="End now" className="btn btn-danger" confirm="Stop showing this alert?" />
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="lg:col-span-2">
            {canSend && (
              <Card title="Post an alert" description="Time-critical notices (closures, weather). SMS is allowed for alerts.">
                <ActionForm action={createAlert} submitLabel="Post alert" resetOnSuccess confirm="Post this alert now?">
                  <div className="space-y-3">
                    <Field label="Severity">
                      <Select
                        name="severity"
                        defaultValue="important"
                        options={[
                          { value: "info", label: "Info" },
                          { value: "important", label: "Important" },
                          { value: "urgent", label: "Urgent" },
                        ]}
                      />
                    </Field>
                    <Field label="Title">
                      <input name="title" required className="field-input" />
                    </Field>
                    <Field label="Message">
                      <textarea name="body" required rows={3} className="field-input" />
                    </Field>
                    <FormGrid>
                      <Field label="Starts" hint="Blank = now">
                        <input type="datetime-local" name="starts_at" className="field-input" />
                      </Field>
                      <Field label="Ends">
                        <input type="datetime-local" name="ends_at" className="field-input" />
                      </Field>
                    </FormGrid>
                    <AudienceFields zones={d.options.zones} classes={d.options.classes} events={d.options.events} initial={{ all_members: true }} />
                  </div>
                </ActionForm>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

type InboxRow = Tables<"inboxes">;
type ThreadRow = Tables<"threads">;
type Options = Awaited<ReturnType<typeof loadAudienceOptions>>;
type Payload =
  | { kind: "campaigns"; options: Options; campaigns: Tables<"comms_campaigns">[] }
  | { kind: "inbox"; options: Options; inboxes: InboxRow[]; threads: ThreadRow[]; names: Map<string, string> }
  | { kind: "whatsapp"; options: Options; requests: Tables<"whatsapp_join_requests">[]; groups: { id: string; name: string }[]; names: Map<string, string> }
  | { kind: "surveys"; options: Options; surveys: Tables<"surveys">[]; responses: { survey_id: string }[] }
  | { kind: "alerts"; options: Options; alerts: Tables<"alerts">[] };

function InboxTab({
  inboxes,
  threads,
  names,
  inboxId,
  tz,
  me,
}: {
  inboxes: InboxRow[];
  threads: ThreadRow[];
  names: Map<string, string>;
  inboxId: string | null;
  tz: string;
  me: string;
}) {
  const current = inboxId ? inboxes.find((i) => i.id === inboxId) : null;
  const shown = threads.filter((t) => (current ? t.inbox_id === current.id : true) && t.status !== "closed");
  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <Card title="Inboxes">
        <ul className="space-y-1">
          <li>
            <Link href="/comms?tab=inbox" className={`flex min-h-11 items-center justify-between rounded-lg px-2 ${!current ? "bg-navy-soft font-semibold" : ""}`}>
              All inboxes <span className="text-xs">{threads.filter((t) => t.status !== "closed").length}</span>
            </Link>
          </li>
          {inboxes.map((i) => {
            const n = threads.filter((t) => t.inbox_id === i.id && t.status !== "closed").length;
            return (
              <li key={i.id}>
                <Link href={`/comms?tab=inbox&inbox=${i.id}`} className={`flex min-h-11 items-center justify-between rounded-lg px-2 ${current?.id === i.id ? "bg-navy-soft font-semibold" : ""}`}>
                  {i.name} <span className="text-xs">{n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={current ? current.name : "Open conversations"} className="lg:col-span-3" description={current ? `Reply within ${current.response_target_hours} hours` : undefined}>
        {shown.length === 0 ? (
          <EmptyState title="Nothing waiting" />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <Link href={`/comms/threads/${t.id}`} className="font-semibold text-navy hover:underline">
                    {t.subject ?? "(no subject)"}
                  </Link>
                  <p className="text-xs text-muted">
                    {t.from_person_id ? (names.get(t.from_person_id) ?? "Member") : (t.from_guest_contact ?? "Guest")} · {formatDateTime(t.created_at, tz)}
                    {!current ? ` · ${inboxes.find((i) => i.id === t.inbox_id)?.name ?? ""}` : ""}
                  </p>
                </div>
                <span className="flex gap-1">
                  {!t.first_response_at && <Badge tone="warning">Needs reply</Badge>}
                  <Badge tone={t.assignee_user === me ? "navy" : "muted"}>{t.assignee_user ? (t.assignee_user === me ? "Yours" : "Assigned") : humanize(t.status)}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
