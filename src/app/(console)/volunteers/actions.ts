"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import { bool, FormError, isoDate, must, oneOf, reqStr, runAction, str } from "@/lib/forms";
import { ok, type ActionResult } from "@/lib/result";

export async function saveGroup(groupId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("volunteers.saveGroup", "save the group", async () => {
    const { supabase, centerId } = await actionContext((a) => can(a, "volunteers.manage"), "Only the volunteer coordinator can change groups.");
    const values = {
      name: reqStr(fd, "name", "Group name"),
      coordinator_person_id: str(fd, "coordinator_person_id"),
      requires_background_check: bool(fd, "requires_background_check"),
      requires_waiver_kind: str(fd, "requires_waiver_kind"),
    };
    if (groupId) must(await supabase.from("volunteer_groups").update(values).eq("id", groupId), "save the group");
    else must(await supabase.from("volunteer_groups").insert({ ...values, center_id: centerId }), "add the group");
    refresh();
    return ok(groupId ? "Group saved." : "Group added.");
  });
}

export async function setInterestStatus(interestId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("volunteers.setInterestStatus", "update the volunteer", async () => {
    const { supabase } = await actionContext((a) => can(a, "volunteers.manage"), "Only the volunteer coordinator can change volunteer status.");
    const status = oneOf(fd, "status", ["interested", "active", "inactive"] as const, "Status");
    must(await supabase.from("volunteer_interests").update({ status }).eq("id", interestId), "update the volunteer");
    refresh();
    return ok(status === "active" ? "Marked active." : status === "inactive" ? "Marked inactive." : "Updated.");
  });
}

export async function addInterest(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("volunteers.addInterest", "add the volunteer", async () => {
    const { supabase, centerId } = await actionContext((a) => can(a, "volunteers.manage"), "Only the volunteer coordinator can add volunteers.");
    must(
      await supabase.from("volunteer_interests").insert({
        center_id: centerId,
        person_id: reqStr(fd, "person_id", "Person"),
        group_id: reqStr(fd, "group_id", "Group"),
        status: oneOf(fd, "status", ["interested", "active"] as const, "Status", "active"),
      }),
      "add the volunteer",
    );
    refresh();
    return ok("Volunteer added.");
  });
}

export async function recordBackgroundCheck(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("volunteers.recordBackgroundCheck", "record the background check", async () => {
    const { supabase, centerId, viewer } = await actionContext((a) => can(a, "safety.manage"), "Only people with safety access can record background checks.");
    const status = oneOf(fd, "status", ["requested", "clear", "flagged", "expired"] as const, "Result");
    const cleared = isoDate(fd, "cleared_on", "Cleared on");
    const expires = isoDate(fd, "expires_on", "Expires on");
    if (status === "clear" && !expires) throw new FormError("Enter when a clear check expires (usually two years).");
    if (cleared && expires && expires <= cleared) throw new FormError("The expiry must be after the clearance date.");
    must(
      await supabase.from("background_checks").insert({
        center_id: centerId,
        person_id: reqStr(fd, "person_id", "Person"),
        provider: str(fd, "provider"),
        provider_ref: str(fd, "provider_ref"),
        status,
        cleared_on: cleared,
        expires_on: expires,
        recorded_by: viewer.userId,
      }),
      "record the background check",
    );
    refresh();
    return ok("Background check recorded.");
  });
}
