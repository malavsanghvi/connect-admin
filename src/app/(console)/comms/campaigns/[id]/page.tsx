import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-form";
import { Badge, Card, DefinitionList, LoadProblem, NoAccess, Notice, PageHeader } from "@/components/ui";
import { can } from "@/lib/access";
import { resolveUserNames } from "@/lib/data/people";
import { formatDateTime, humanize } from "@/lib/format";
import { describeAudience, requiresSecondApprover } from "@/lib/logic/audience";
import { getSupabase, load, requireViewer, row } from "@/lib/session";
import { approveAsSecond, approveCampaign, scheduleCampaign, setCampaignStatus } from "../../actions";
import { CampaignForm, loadAudienceOptions } from "../../shared";

export const metadata: Metadata = { title: "Message" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!can(v.access, "comms.view", "comms.send")) return <NoAccess area="communications" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const res = await load(async () => {
    const c = row(await supabase.from("comms_campaigns").select("*").eq("id", id).maybeSingle(), "the message");
    if (!c) return null;
    const [options, people] = await Promise.all([
      loadAudienceOptions(supabase, v.center.id),
      resolveUserNames(supabase, v.center.id, [c.created_by, c.approved_by, c.second_approver]),
    ]);
    return { c, options, people };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { c, options, people } = res.data;
  const who = (uid: string | null) => (uid === v.userId ? "you" : uid ? (people.get(uid) ?? "a colleague") : "—");
  const needsSecond = c.requires_second_approver || requiresSecondApprover(c.audience);
  const canApprove = can(v.access, "comms.approve");
  const canSend = can(v.access, "comms.send");
  const editable = canSend && ["draft", "pending_approval", "scheduled"].includes(c.status);
  const names = {
    zones: new Map(options.zones.map((z) => [z.id, z.name])),
    classes: new Map(options.classes.map((x) => [x.id, x.name])),
    events: new Map(options.events.map((e) => [e.id, e.name])),
  };

  return (
    <>
      <PageHeader
        title={c.title}
        back={{ href: "/comms?tab=campaigns", label: "Announcements" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={c.status === "sent" ? "success" : c.status === "pending_approval" ? "warning" : c.status === "scheduled" ? "navy" : c.status === "cancelled" ? "danger" : "muted"}>
              {c.status === "pending_approval" ? "Waiting for a second approver" : humanize(c.status)}
            </Badge>
            {describeAudience(c.audience, names)}
          </span>
        }
      />

      <Card title="Approval" className="mb-6">
        <DefinitionList
          items={[
            ["Written by", who(c.created_by)],
            ["Audience", describeAudience(c.audience, names)],
            ["Approvals needed", needsSecond ? "Two different people (sends to all members)" : "One"],
            ["First approval", c.approved_by ? who(c.approved_by) : "Not yet"],
            ...(needsSecond ? ([["Second approval", c.second_approver ? who(c.second_approver) : "Not yet"]] as [string, string][]) : []),
            ["Send at", c.scheduled_at ? formatDateTime(c.scheduled_at, tz) : "As soon as approved"],
            ...(c.sent_at ? ([["Sent", `${formatDateTime(c.sent_at, tz)} · ${c.recipients_count ?? "?"} recipients`]] as [string, string][]) : []),
          ]}
        />
        {c.status === "pending_approval" && (
          <div className="mt-4">
            <Notice tone="warning">
              Waiting for a second approver. Someone other than {who(c.approved_by)} with approval rights must approve before it can be scheduled.
            </Notice>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {c.status === "draft" && canApprove && (
            <ActionButton
              action={approveCampaign.bind(null, c.id)}
              label={needsSecond ? "Approve (first of two)" : "Approve and schedule"}
              className="btn btn-primary"
              confirm={needsSecond ? "Approve this all-member message? A second person must also approve." : "Approve and schedule this message?"}
            />
          )}
          {c.status === "pending_approval" && canApprove && !c.second_approver && c.approved_by !== v.userId && (
            <ActionButton action={approveAsSecond.bind(null, c.id)} label="Approve as second approver" className="btn btn-primary" />
          )}
          {c.status === "pending_approval" && (canApprove || canSend) && (
            <ActionButton action={scheduleCampaign.bind(null, c.id)} label="Schedule send" className="btn btn-success" confirm="Schedule this message to all members?" />
          )}
          {(c.status === "pending_approval" || c.status === "scheduled") && canSend && (
            <ActionButton action={setCampaignStatus.bind(null, c.id)} fields={{ to: "draft" }} label="Back to draft" />
          )}
          {c.status !== "sent" && c.status !== "cancelled" && canSend && (
            <ActionButton action={setCampaignStatus.bind(null, c.id)} fields={{ to: "cancelled" }} label="Cancel" className="btn btn-danger" confirm="Cancel this message?" />
          )}
        </div>
        {c.status === "draft" && !canApprove && <p className="mt-2 text-sm text-muted">An approver (communications officer) must approve before it can go out.</p>}
      </Card>

      {editable ? (
        <Card title="Message" description={c.status !== "draft" ? "Editing sends it back to draft; approvals start again." : undefined}>
          <CampaignForm campaign={c} options={options} tz={tz} />
        </Card>
      ) : (
        <Card title="Message">
          <p className="whitespace-pre-line text-sm">{c.body_md}</p>
          <p className="mt-2 text-xs text-muted">Channels: {c.channels.map(humanize).join(", ")}</p>
        </Card>
      )}
    </>
  );
}
