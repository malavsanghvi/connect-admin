import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoadProblem, NoAccess } from "@/components/ui";
import { areas } from "@/lib/access";
import { getSupabase, load, requireViewer, row } from "@/lib/session";
import { CheckInScreen } from "./checkin-screen";

export const metadata: Metadata = { title: "Check-in" };

export default async function CheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const v = await requireViewer();
  if (!areas.checkIn(v.access, eventId)) {
    return <NoAccess>You&apos;re not a check-in volunteer for this event. Ask the event lead to add you.</NoAccess>;
  }
  const supabase = await getSupabase();
  const res = await load(async () => {
    const event = row(await supabase.from("events").select("id, name, status, lunch_enabled").eq("id", eventId).maybeSingle(), "the event");
    if (!event) return null;
    const [checkedIn, rsvpd] = await Promise.all([
      supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("checked_in_at", "is", null),
      supabase.from("attendees").select("id", { count: "exact", head: true }).eq("event_id", eventId).neq("status", "cancelled"),
    ]);
    if (checkedIn.error) console.error("[checkin] count failed", checkedIn.error);
    if (rsvpd.error) console.error("[checkin] RSVP count failed", rsvpd.error);
    return { event, checkedIn: checkedIn.count ?? 0, expected: rsvpd.count ?? 0 };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { event, checkedIn, expected } = res.data;
  return (
    <CheckInScreen
      eventId={event.id}
      eventStatus={event.status}
      initialCheckedIn={checkedIn}
      expected={expected}
      timeZone={v.center.time_zone}
    />
  );
}
