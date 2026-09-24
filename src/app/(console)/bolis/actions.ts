"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { can, hasScopedRole } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import { bool, cents, dateTime, FormError, int, must, oneOf, reqStr, runAction, str } from "@/lib/forms";
import { ok, type ActionResult } from "@/lib/result";

// Terminology (founder rule): bolis take "pledges", never "bids".

const manage = (a: Parameters<typeof can>[0]) => can(a, "bolis.manage");

function boliValues(fd: FormData, tz: string) {
  const opens = dateTime(fd, "opens_at", "Opens", tz);
  const closes = dateTime(fd, "closes_at", "Closes", tz);
  if (opens && closes && closes <= opens) throw new FormError("The boli must close after it opens.");
  const step = cents(fd, "step", "Step");
  if (step !== null && step <= 0) throw new FormError("The step must be more than zero.");
  return {
    name: reqStr(fd, "name", "Boli name"),
    description: str(fd, "description"),
    kind: oneOf(fd, "kind", ["digital", "in_person"] as const, "Kind", "digital"),
    event_id: str(fd, "event_id"),
    floor_cents: cents(fd, "floor", "Starting pledge") ?? 0,
    step_cents: step ?? 2100,
    opens_at: opens,
    closes_at: closes,
    soft_close_minutes: int(fd, "soft_close_minutes", "Extension", { min: 0, max: 120 }) ?? 0,
    explainer_md: str(fd, "explainer_md"),
    explainer_video_url: str(fd, "explainer_video_url"),
    keep_all_entries: bool(fd, "keep_all_entries"),
  };
}

export async function saveBoli(boliId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("bolis.saveBoli", "save the boli", async () => {
    const { supabase, centerId, viewer, tz } = await actionContext(manage, "Only the religious coordinator (bolis.manage) can set up bolis.");
    const values = boliValues(fd, tz);
    if (boliId) {
      must(await supabase.from("bolis").update(values).eq("id", boliId), "save the boli");
      refresh();
      return ok("Boli saved.");
    }
    const created = must(await supabase.from("bolis").insert({ ...values, center_id: centerId, created_by: viewer.userId }).select("id").single(), "create the boli");
    redirect(`/bolis/${created!.id}`);
  });
}

export async function setBoliStatus(boliId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("bolis.setBoliStatus", "change the boli status", async () => {
    const { supabase } = await actionContext(manage, "Only the religious coordinator can open or pause bolis.");
    const status = oneOf(fd, "status", ["draft", "open", "paused"] as const, "Status");
    must(await supabase.from("bolis").update({ status }).eq("id", boliId), "change the boli status");
    refresh();
    return ok(status === "open" ? "Published — pledges are open." : status === "paused" ? "Paused." : "Back to draft.");
  });
}

export async function closeBoli(boliId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("bolis.closeBoli", "close the boli", async () => {
    const { supabase } = await actionContext(manage, "Only the religious coordinator can close bolis.");
    const { data, error } = await supabase.rpc("close_boli", { p_boli: boliId });
    if (error) throw error;
    refresh();
    return ok(data ? "Closed — the top pledge is now a pledge record for the family." : "Closed with no pledges.");
  });
}

/** Record an in-person pledge called out in the hall. */
export async function recordInPersonPledge(boliId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("bolis.recordInPersonPledge", "record the pledge", async () => {
    const { supabase, centerId, viewer } = await actionContext();
    const boli = must(await supabase.from("bolis").select("id, kind, event_id, status, floor_cents").eq("id", boliId).maybeSingle(), "load the boli");
    if (!boli) throw new FormError("That boli no longer exists or you can't see it.");
    const allowed =
      can(viewer.access, "bolis.manage", "bolis.record") || (boli.event_id !== null && hasScopedRole(viewer.access, boli.event_id, "boli_recorder"));
    if (!allowed) throw new FormError("Only boli recorders for this event can record pledges.");
    if (boli.kind !== "in_person") throw new FormError("Digital bolis take pledges in the member app.");
    if (boli.status === "closed" || boli.status === "settled") throw new FormError("This boli is closed.");
    const amount = cents(fd, "amount", "Pledge amount");
    if (!amount || amount <= 0) throw new FormError("Enter the pledge amount.");
    if (amount < boli.floor_cents) throw new FormError("The pledge is below the starting amount.");
    must(
      await supabase.from("boli_entries").insert({
        center_id: centerId,
        boli_id: boliId,
        household_id: reqStr(fd, "household_id", "Family"),
        amount_cents: amount,
        entered_by: viewer.userId,
        is_in_person: true,
        display_name: str(fd, "display_name"),
        anonymous: bool(fd, "anonymous"),
      }),
      "record the pledge",
    );
    refresh();
    return ok("Pledge recorded.");
  });
}
