"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { can, hasScopedRole } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import type { Database, Json, TablesUpdate } from "@/lib/database.types";
import { all, bool, dateTime, FormError, must, oneOf, reqStr, runAction, str } from "@/lib/forms";
import { buildAudience, requiresSecondApprover, type AudiencePreset } from "@/lib/logic/audience";
import { ok, type ActionResult } from "@/lib/result";

type Channel = Database["app"]["Enums"]["channel"];
const CHANNELS = ["push", "email", "sms", "whatsapp", "in_app"] as const;
const KINDS = ["announcement", "newsletter", "appeal", "event", "pathshala_update", "alert", "survey"] as const;

const send = (a: Parameters<typeof can>[0]) => can(a, "comms.send");

function audienceFrom(fd: FormData) {
  const preset = oneOf(fd, "audience_preset", ["all_members", "zone", "pathshala_class", "event_rsvps", "custom"] as const, "Audience", "all_members") as AudiencePreset;
  const built = buildAudience(preset, {
    zoneIds: all(fd, "zone_ids"),
    classIds: all(fd, "class_ids"),
    eventId: str(fd, "event_id"),
    rsvpStatuses: all(fd, "rsvp_statuses"),
    customJson: str(fd, "custom_json") ?? "",
  });
  if (!built.ok) throw new FormError(built.error);
  return built.audience as Json;
}

// ---------------------------------------------------------------------------
// Campaigns (announcements / newsletters) with the two-person rule
// ---------------------------------------------------------------------------
export async function saveCampaign(campaignId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.saveCampaign", "save the message", async () => {
    const { supabase, centerId, viewer, tz } = await actionContext(send, "Only the communications team can compose messages.");
    const audience = audienceFrom(fd);
    const channels = all(fd, "channels").filter((c): c is Channel => (CHANNELS as readonly string[]).includes(c));
    if (!channels.length) throw new FormError("Choose at least one channel.");
    const values = {
      kind: oneOf(fd, "kind", KINDS, "Type", "announcement"),
      title: reqStr(fd, "title", "Title"),
      body_md: reqStr(fd, "body_md", "Message"),
      channels,
      audience,
      scheduled_at: dateTime(fd, "scheduled_at", "Send at", tz),
      requires_second_approver: requiresSecondApprover(audience),
    };
    if (campaignId) {
      const cur = must(await supabase.from("comms_campaigns").select("status").eq("id", campaignId).maybeSingle(), "load the message");
      if (!cur) throw new FormError("That message no longer exists.");
      if (!["draft", "pending_approval", "scheduled"].includes(cur.status)) throw new FormError("This message has already gone out and can't be edited.");
      // Any edit sends it back to draft: approvals were for the old text.
      must(
        await supabase
          .from("comms_campaigns")
          .update({ ...values, status: "draft", approved_by: null, second_approver: null })
          .eq("id", campaignId),
        "save the message",
      );
      refresh();
      return ok(cur.status === "draft" ? "Draft saved." : "Saved — it's back to draft and needs approval again.");
    }
    const created = must(
      await supabase.from("comms_campaigns").insert({ ...values, center_id: centerId, created_by: viewer.userId, status: "draft" }).select("id").single(),
      "save the message",
    );
    redirect(`/comms/campaigns/${created!.id}`);
  });
}

/** First approval. All-member sends wait for a second, different approver. */
export async function approveCampaign(campaignId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("comms.approveCampaign", "approve the message", async () => {
    const { supabase, viewer } = await actionContext((a) => can(a, "comms.approve"), "Only communications approvers can approve messages.");
    const c = must(await supabase.from("comms_campaigns").select("status, audience, requires_second_approver, scheduled_at").eq("id", campaignId).maybeSingle(), "load the message");
    if (!c) throw new FormError("That message no longer exists.");
    if (c.status !== "draft") throw new FormError("Only drafts can be approved.");
    const needsSecond = c.requires_second_approver || requiresSecondApprover(c.audience);
    const patch: TablesUpdate<"comms_campaigns"> = needsSecond
      ? { approved_by: viewer.userId, requires_second_approver: true, status: "pending_approval" }
      : { approved_by: viewer.userId, status: "scheduled", scheduled_at: c.scheduled_at ?? new Date().toISOString() };
    must(await supabase.from("comms_campaigns").update(patch).eq("id", campaignId), needsSecond ? "approve the message" : "schedule the message");
    refresh();
    return ok(needsSecond ? "Approved. Waiting for a second approver." : "Approved and scheduled.");
  });
}

export async function approveAsSecond(campaignId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("comms.approveAsSecond", "add your approval", async () => {
    const { supabase } = await actionContext((a) => can(a, "comms.approve"), "Only communications approvers can approve messages.");
    const { error } = await supabase.rpc("approve_as_second", { p_table: "comms_campaigns", p_id: campaignId });
    if (error) throw error;
    refresh();
    return ok("Second approval recorded. It can be scheduled now.");
  });
}

export async function scheduleCampaign(campaignId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("comms.scheduleCampaign", "schedule the send", async () => {
    const { supabase } = await actionContext((a) => can(a, "comms.approve", "comms.send"), "Only the communications team can schedule sends.");
    const c = must(await supabase.from("comms_campaigns").select("status, scheduled_at, approved_by").eq("id", campaignId).maybeSingle(), "load the message");
    if (!c) throw new FormError("That message no longer exists.");
    if (!c.approved_by) throw new FormError("Approve the message first.");
    // The database refuses this for all-member sends without two different approvers.
    must(
      await supabase
        .from("comms_campaigns")
        .update({ status: "scheduled", scheduled_at: c.scheduled_at ?? new Date().toISOString() })
        .eq("id", campaignId),
      "schedule the send",
    );
    refresh();
    return ok("Scheduled.");
  });
}

export async function setCampaignStatus(campaignId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.setCampaignStatus", "update the message", async () => {
    const { supabase } = await actionContext(send, "Only the communications team can change messages.");
    const to = oneOf(fd, "to", ["draft", "cancelled"] as const, "Status");
    const patch: TablesUpdate<"comms_campaigns"> = to === "draft" ? { status: "draft", approved_by: null, second_approver: null } : { status: "cancelled" };
    must(await supabase.from("comms_campaigns").update(patch).eq("id", campaignId), "update the message");
    refresh();
    return ok(to === "draft" ? "Back to draft." : "Cancelled.");
  });
}

// ---------------------------------------------------------------------------
// Inbox threads
// ---------------------------------------------------------------------------
async function inboxCtx(threadId: string) {
  const ctx = await actionContext();
  const t = must(await ctx.supabase.from("threads").select("id, inbox_id, status, first_response_at").eq("id", threadId).maybeSingle(), "load the conversation");
  if (!t) throw new FormError("That conversation no longer exists or you can't see it.");
  const inbox = must(await ctx.supabase.from("inboxes").select("zone_id").eq("id", t.inbox_id).maybeSingle(), "load the inbox");
  const allowed = can(ctx.viewer.access, "comms.inbox") || (inbox?.zone_id ? hasScopedRole(ctx.viewer.access, inbox.zone_id, "zone_lead") : false);
  if (!allowed) throw new FormError("You don't handle this inbox.");
  return { ...ctx, thread: t };
}

export async function replyToThread(threadId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.replyToThread", "send the reply", async () => {
    const { supabase, centerId, viewer, thread } = await inboxCtx(threadId);
    must(
      await supabase.from("thread_messages").insert({ center_id: centerId, thread_id: threadId, author_user: viewer.userId, from_role: true, body: reqStr(fd, "body", "Reply") }),
      "send the reply",
    );
    const patch: TablesUpdate<"threads"> = { status: bool(fd, "close") ? "closed" : "waiting" };
    if (!thread.first_response_at) patch.first_response_at = new Date().toISOString();
    if (bool(fd, "close")) patch.closed_at = new Date().toISOString();
    must(await supabase.from("threads").update(patch).eq("id", threadId), "update the conversation");
    refresh();
    return ok(bool(fd, "close") ? "Replied and closed." : "Reply sent (from the inbox, not your personal number).");
  });
}

export async function setThread(threadId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.setThread", "update the conversation", async () => {
    const { supabase, viewer } = await inboxCtx(threadId);
    const action = oneOf(fd, "do", ["assign_me", "unassign", "close", "reopen"] as const, "Action");
    const patch: TablesUpdate<"threads"> =
      action === "assign_me"
        ? { assignee_user: viewer.userId, status: "assigned" }
        : action === "unassign"
          ? { assignee_user: null, status: "open" }
          : action === "close"
            ? { status: "closed", closed_at: new Date().toISOString() }
            : { status: "open", closed_at: null };
    must(await supabase.from("threads").update(patch).eq("id", threadId), "update the conversation");
    refresh();
    return ok({ assign_me: "Assigned to you.", unassign: "Unassigned.", close: "Closed.", reopen: "Reopened." }[action]);
  });
}

// ---------------------------------------------------------------------------
// WhatsApp join queue
// ---------------------------------------------------------------------------
export async function handleJoinRequest(requestId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.handleJoinRequest", "update the request", async () => {
    const { supabase, viewer } = await actionContext(send, "Only the communications team handles WhatsApp requests.");
    const status = oneOf(fd, "status", ["approved", "added", "declined"] as const, "Decision");
    must(
      await supabase.from("whatsapp_join_requests").update({ status, handled_by: viewer.userId, handled_at: new Date().toISOString() }).eq("id", requestId),
      "update the request",
    );
    refresh();
    return ok(status === "added" ? "Marked as added to the group." : status === "approved" ? "Approved — add them in WhatsApp, then mark added." : "Declined.");
  });
}

// ---------------------------------------------------------------------------
// Surveys
// ---------------------------------------------------------------------------
export async function saveSurvey(surveyId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.saveSurvey", "save the survey", async () => {
    const { supabase, centerId, viewer, tz } = await actionContext(send, "Only the communications team can build surveys.");
    let questions: unknown;
    try {
      questions = JSON.parse(reqStr(fd, "questions", "Questions"));
    } catch {
      throw new FormError("The questions couldn't be read. Reload the page and try again.");
    }
    if (!Array.isArray(questions) || !questions.length) throw new FormError("Add at least one question.");
    for (const q of questions as { label?: string; type?: string; options?: string[] }[]) {
      if (!q.label?.trim()) throw new FormError("Every question needs a label.");
      if ((q.type === "single" || q.type === "multi") && !(q.options ?? []).length) throw new FormError(`Add choices for "${q.label}".`);
    }
    const opens = dateTime(fd, "opens_at", "Opens", tz);
    const closes = dateTime(fd, "closes_at", "Closes", tz);
    if (opens && closes && closes <= opens) throw new FormError("The survey must close after it opens.");
    const values = {
      title: reqStr(fd, "title", "Title"),
      description: str(fd, "description"),
      questions: questions as Json,
      audience: audienceFrom(fd),
      anonymous: bool(fd, "anonymous"),
      opens_at: opens,
      closes_at: closes,
    };
    if (surveyId) {
      must(await supabase.from("surveys").update(values).eq("id", surveyId), "save the survey");
      refresh();
      return ok("Survey saved.");
    }
    const created = must(await supabase.from("surveys").insert({ ...values, center_id: centerId, created_by: viewer.userId }).select("id").single(), "create the survey");
    redirect(`/comms/surveys/${created!.id}`);
  });
}

export async function setSurveyStatus(surveyId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.setSurveyStatus", "update the survey", async () => {
    const { supabase } = await actionContext(send, "Only the communications team can open or close surveys.");
    const status = oneOf(fd, "status", ["draft", "open", "closed"] as const, "Status");
    must(await supabase.from("surveys").update({ status }).eq("id", surveyId), "update the survey");
    refresh();
    return ok(status === "open" ? "Survey is open." : status === "closed" ? "Survey closed." : "Back to draft.");
  });
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export async function createAlert(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("comms.createAlert", "post the alert", async () => {
    const { supabase, centerId, viewer, tz } = await actionContext(send, "Only the communications team can post alerts.");
    const starts = dateTime(fd, "starts_at", "Starts", tz) ?? new Date().toISOString();
    const ends = dateTime(fd, "ends_at", "Ends", tz);
    if (ends && ends <= starts) throw new FormError("The alert must end after it starts.");
    must(
      await supabase.from("alerts").insert({
        center_id: centerId,
        severity: oneOf(fd, "severity", ["info", "important", "urgent"] as const, "Severity", "info"),
        title: reqStr(fd, "title", "Title"),
        body: reqStr(fd, "body", "Message"),
        audience: audienceFrom(fd),
        starts_at: starts,
        ends_at: ends,
        created_by: viewer.userId,
      }),
      "post the alert",
    );
    refresh();
    return ok("Alert posted.");
  });
}

export async function endAlert(alertId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("comms.endAlert", "end the alert", async () => {
    const { supabase } = await actionContext(send, "Only the communications team can end alerts.");
    must(await supabase.from("alerts").update({ ends_at: new Date().toISOString() }).eq("id", alertId), "end the alert");
    refresh();
    return ok("Alert ended.");
  });
}
