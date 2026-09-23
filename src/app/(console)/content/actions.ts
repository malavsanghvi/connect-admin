"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/access";
import { actionContext } from "@/lib/action-context";
import { bool, FormError, int, isoDate, must, oneOf, reqStr, runAction, str, time } from "@/lib/forms";
import { ok, type ActionResult } from "@/lib/result";

const manage = (a: Parameters<typeof can>[0]) => can(a, "content.manage");
const DENIED = "Only content managers can change this.";

export async function saveGuideSection(sectionId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("content.saveGuideSection", "save the guide section", async () => {
    const { supabase, centerId } = await actionContext(manage, DENIED);
    const slug = reqStr(fd, "slug", "Web address").toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) throw new FormError("The web address can only use lowercase letters, numbers and dashes.");
    const values = {
      slug,
      title: reqStr(fd, "title", "Title"),
      body_md: reqStr(fd, "body_md", "Text"),
      sort_order: int(fd, "sort_order", "Order") ?? 0,
      public: bool(fd, "public"),
      is_checklist: bool(fd, "is_checklist"),
    };
    if (sectionId) must(await supabase.from("guide_sections").update(values).eq("id", sectionId), "save the guide section");
    else must(await supabase.from("guide_sections").insert({ ...values, center_id: centerId }), "add the guide section");
    refresh();
    return ok(sectionId ? "Section saved." : "Section added.");
  });
}

export async function savePractice(practiceId: string | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("content.savePractice", "save the practice", async () => {
    const { supabase, centerId } = await actionContext(manage, DENIED);
    const key = reqStr(fd, "key", "Key").toLowerCase().replace(/\s+/g, "_");
    const values = {
      category: reqStr(fd, "category", "Category"),
      key,
      name: reqStr(fd, "name", "Name"),
      description: str(fd, "description"),
      default_minutes: int(fd, "default_minutes", "Minutes", { min: 0 }),
      points: int(fd, "points", "Points", { min: 0, max: 1000 }) ?? 1,
      sort_order: int(fd, "sort_order", "Order") ?? 0,
      active: bool(fd, "active"),
    };
    if (practiceId) must(await supabase.from("practices").update(values).eq("id", practiceId).eq("center_id", centerId), "save the practice");
    else must(await supabase.from("practices").insert({ ...values, center_id: centerId }), "add the practice");
    refresh();
    return ok(practiceId ? "Practice saved." : "Practice added.");
  });
}

export async function saveTimings(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("content.saveTimings", "save the timings", async () => {
    const { supabase, centerId } = await actionContext(manage, DENIED);
    const onDate = isoDate(fd, "on_date", "Date");
    if (!onDate) throw new FormError("Choose the date.");
    must(
      await supabase.from("daily_timings").upsert(
        {
          center_id: centerId,
          on_date: onDate,
          sunrise: time(fd, "sunrise", "Sunrise"),
          sunset: time(fd, "sunset", "Sunset"),
          navkarsi: time(fd, "navkarsi", "Navkarsi"),
          chauvihar: time(fd, "chauvihar", "Chauvihar"),
          aarti: time(fd, "aarti", "Aarti"),
          temple_open: time(fd, "temple_open", "Temple opens"),
          temple_close: time(fd, "temple_close", "Temple closes"),
        },
        { onConflict: "center_id,on_date" },
      ),
      "save the timings",
    );
    refresh();
    return ok("Timings saved.");
  });
}

export async function saveCalendarEntry(fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("content.saveCalendarEntry", "add the calendar entry", async () => {
    const { supabase, centerId } = await actionContext(manage, DENIED);
    const starts = isoDate(fd, "starts_on", "Date");
    if (!starts) throw new FormError("Choose the date.");
    const ends = isoDate(fd, "ends_on", "End date");
    if (ends && ends < starts) throw new FormError("The end date must be on or after the start.");
    must(
      await supabase.from("calendar_entries").insert({
        center_id: centerId,
        layer_id: reqStr(fd, "layer_id", "Layer"),
        title: reqStr(fd, "title", "Title"),
        starts_on: starts,
        ends_on: ends,
        all_day: true,
      }),
      "add the calendar entry",
    );
    refresh();
    return ok("Added to the calendar.");
  });
}

export async function deleteCalendarEntry(entryId: string, fd: FormData): Promise<ActionResult<unknown>> {
  void fd;
  return runAction("content.deleteCalendarEntry", "remove the calendar entry", async () => {
    const { supabase } = await actionContext(manage, DENIED);
    const res = must(await supabase.from("calendar_entries").delete().eq("id", entryId).select("id"), "remove the calendar entry");
    if (!res?.length) throw new FormError("You can't remove this entry.");
    refresh();
    return ok("Removed.");
  });
}

export async function moderatePhoto(photoId: string, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction("content.moderatePhoto", "moderate the photo", async () => {
    const { supabase, viewer } = await actionContext(manage, DENIED);
    const status = oneOf(fd, "status", ["approved", "rejected", "removed"] as const, "Decision");
    must(await supabase.from("photos").update({ status, moderated_by: viewer.userId }).eq("id", photoId), "moderate the photo");
    refresh();
    return ok(status === "approved" ? "Approved." : status === "rejected" ? "Rejected." : "Removed.");
  });
}
