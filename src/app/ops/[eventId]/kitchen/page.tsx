import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { LoadProblem, NoAccess } from "@/components/ui";
import { areas, can, hasScopedRole } from "@/lib/access";
import { formatTime, fromDateTimeLocal, todayIso, addDays } from "@/lib/format";
import { lunchSlotCounts, UNLIMITED_SEATS } from "@/lib/logic/event-report";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { setSlotStatus } from "@/app/(console)/events/actions";

export const metadata: Metadata = { title: "Kitchen display" };

export default async function KitchenPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const v = await requireViewer();
  if (!areas.kitchen(v.access, eventId)) return <NoAccess>The kitchen display is for the kitchen lead and event lead.</NoAccess>;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const today = todayIso(tz);
  const canRun = can(v.access, "events.manage") || hasScopedRole(v.access, eventId, "event_lead", "kitchen_lead");

  const res = await load(async () => {
    const event = row(await supabase.from("events").select("id, name, starts_at, lunch_enabled").eq("id", eventId).maybeSingle(), "the event");
    if (!event) return null;
    const [slots, attendees, windows] = await Promise.all([
      supabase.from("lunch_slots").select("id, starts_at, seats, status").eq("event_id", eventId).order("starts_at"),
      supabase
        .from("attendees")
        .select("id, rsvp_id, status, checked_in_at, served_food_at, lunch_slot_id, is_child_under_12, is_senior, needs_assistance")
        .eq("event_id", eventId),
      supabase
        .from("pickup_windows")
        .select("id, starts_at, ends_at, location, event_id")
        // Timestamps are quoted: PostgREST treats "." and ":" as reserved inside or().
        .or(`event_id.eq.${eventId},and(starts_at.gte."${fromDateTimeLocal(`${today}T00:00`, tz)}",starts_at.lt."${fromDateTimeLocal(`${addDays(today, 1)}T00:00`, tz)}")`)
        .order("starts_at"),
    ]);
    // Store orders need store or kitchen permission; the display still works without them.
    let storeNote: string | null = null;
    let orders: { id: string; order_number: string; status: string; pickup_window_id: string | null; guest_name: string | null }[] = [];
    let lines: { order_id: string; item_id: string; quantity: number; is_gift: boolean }[] = [];
    let items: { id: string; name: string }[] = [];
    const w = windows.error ? [] : (windows.data ?? []);
    if (windows.error) {
      console.error("[kitchen] pickup windows unavailable", windows.error);
      storeNote = "Store pickup windows couldn't be loaded for your role.";
    } else if (w.length) {
      const o = await supabase
        .from("store_orders")
        .select("id, order_number, status, pickup_window_id, guest_name")
        .in("pickup_window_id", w.map((x) => x.id))
        .in("status", ["placed", "preparing", "ready"]);
      if (o.error) {
        console.error("[kitchen] store orders unavailable", o.error);
        storeNote = "Store orders need kitchen or store access.";
      } else {
        orders = o.data ?? [];
        if (orders.length) {
          const l = await supabase.from("store_order_lines").select("order_id, item_id, quantity, is_gift").in("order_id", orders.map((x) => x.id));
          if (l.error) {
            console.error("[kitchen] order lines unavailable", l.error);
            storeNote = "Order items couldn't be loaded.";
          } else lines = l.data ?? [];
          const ids = [...new Set(lines.map((x) => x.item_id))];
          if (ids.length) {
            const it = await supabase.from("store_items").select("id, name").in("id", ids);
            if (it.error) console.error("[kitchen] item names unavailable", it.error);
            items = it.data ?? [];
          }
        }
      }
    }
    return { event, slots: rows(slots, "lunch slots"), attendees: rows(attendees, "attendees"), windows: w, orders, lines, items, storeNote };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { slots, attendees, windows, orders, lines, items, storeNote } = res.data;
  const counts = lunchSlotCounts(slots, attendees);
  const serving = counts.find((s) => s.status === "now_serving");
  const next = counts.find((s) => s.status === "scheduled" && (!serving || s.starts_at > serving.starts_at));
  const checkedIn = attendees.filter((a) => a.checked_in_at).length;
  const noSlot = attendees.filter((a) => a.checked_in_at && !a.lunch_slot_id).length;
  const served = attendees.filter((a) => a.served_food_at).length;
  const prep = new Map<string, number>();
  for (const l of lines) {
    const o = orders.find((x) => x.id === l.order_id);
    if (o && o.status !== "ready") prep.set(l.item_id, (prep.get(l.item_id) ?? 0) + l.quantity);
  }

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={20} timeZone={tz} />
      <section className="rounded-2xl bg-success p-6 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-widest">Now serving</p>
        <p className="font-display text-6xl font-semibold">{serving ? formatTime(serving.starts_at, tz) : "—"}</p>
        {serving && (
          <p className="mt-1 text-lg">
            {serving.assignedCount} assigned · {serving.servedCount} served
          </p>
        )}
        {next && <p className="mt-2 text-base opacity-90">Next: {formatTime(next.starts_at, tz)} · {next.assignedCount} people</p>}
      </section>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white p-3">
          <p className="font-display text-3xl font-semibold">{checkedIn}</p>
          <p className="text-xs text-muted">checked in</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="font-display text-3xl font-semibold">{served}</p>
          <p className="text-xs text-muted">served</p>
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="font-display text-3xl font-semibold">{noSlot}</p>
          <p className="text-xs text-muted">no slot yet</p>
        </div>
      </div>
      <section className="rounded-xl bg-white p-4">
        <h2 className="mb-2 font-display text-xl font-semibold">Headcount by slot</h2>
        {counts.length === 0 ? (
          <p className="text-sm text-muted">No lunch slots yet — they appear with the first check-in.</p>
        ) : (
          <ul className="divide-y divide-line">
            {counts.map((s) => (
              <li key={s.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 ${s.status === "now_serving" ? "bg-success-soft px-2" : ""}`}>
                <span className="text-2xl font-semibold">{formatTime(s.starts_at, tz)}</span>
                <span className="text-lg">
                  <strong>{s.assignedCount}</strong>
                  {s.seats < UNLIMITED_SEATS ? ` / ${s.seats}` : ""} · {s.servedCount} served
                  <span className="ml-2 text-sm text-muted">{s.status === "done" ? "done" : s.status === "now_serving" ? "serving" : ""}</span>
                </span>
                {canRun && s.status !== "now_serving" && s.status !== "done" && (
                  <ActionButton action={setSlotStatus.bind(null, eventId, s.id)} fields={{ status: "now_serving" }} label="Start serving" className="btn btn-success min-h-12" />
                )}
                {canRun && s.status === "now_serving" && (
                  <ActionButton action={setSlotStatus.bind(null, eventId, s.id)} fields={{ status: "done" }} label="Done" className="btn btn-secondary min-h-12" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl bg-white p-4">
        <h2 className="mb-2 font-display text-xl font-semibold">Store orders due</h2>
        {storeNote && <p className="mb-2 rounded-lg bg-warning-soft p-2 text-sm text-warning">{storeNote}</p>}
        {windows.length === 0 ? (
          <p className="text-sm text-muted">No pickup windows for this event or today.</p>
        ) : (
          <>
            {prep.size > 0 && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">To prepare</h3>
                <ul className="mb-3 grid grid-cols-2 gap-2">
                  {[...prep.entries()].map(([itemId, qty]) => (
                    <li key={itemId} className="rounded-lg bg-sand p-2 text-lg">
                      <strong>{qty}×</strong> {items.find((i) => i.id === itemId)?.name ?? "Item"}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <ul className="divide-y divide-line">
              {windows.map((w) => {
                const os = orders.filter((o) => o.pickup_window_id === w.id);
                return (
                  <li key={w.id} className="py-2">
                    <p className="font-semibold">
                      {formatTime(w.starts_at, tz)}–{formatTime(w.ends_at, tz)}
                      {w.location ? ` · ${w.location}` : ""}
                    </p>
                    <p className="text-sm text-muted">
                      {os.length} orders · {os.filter((o) => o.status === "placed").length} placed · {os.filter((o) => o.status === "preparing").length} preparing ·{" "}
                      {os.filter((o) => o.status === "ready").length} ready
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
