import { Card, DefinitionList } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { formatCents, formatDateTime, humanize } from "@/lib/format";
import { EventForm } from "../event-form";

export function DetailsTab({ event, canEdit, tz, ownerName }: { event: Tables<"events">; canEdit: boolean; tz: string; ownerName: string | null }) {
  const commit = event.commitment_options as { per_person?: number[]; lump_sum?: number[]; open?: boolean };
  const flyerUrl = event.flyer_path && /^https?:\/\//.test(event.flyer_path) ? event.flyer_path : null;
  if (canEdit) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <EventForm event={event} tz={tz} owner={event.owner_person_id ? { id: event.owner_person_id, name: ownerName ?? "Event lead", detail: null } : null} />
        </Card>
        {flyerUrl && (
          <Card title="Flyer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flyerUrl} alt={`Flyer for ${event.name}`} className="w-full rounded-lg border border-line" />
          </Card>
        )}
      </div>
    );
  }
  return (
    <Card>
      <DefinitionList
        items={[
          ["Starts", formatDateTime(event.starts_at, tz)],
          ["Ends", formatDateTime(event.ends_at, tz)],
          ["Venue", event.venue ?? "—"],
          ["Audience", humanize(event.audience)],
          ["Capacity", event.capacity ?? "No limit"],
          ["RSVP window", `${formatDateTime(event.rsvp_opens_at, tz)} → ${formatDateTime(event.rsvp_closes_at, tz)}`],
          ["Attendee questions", (event.attendee_flags as string[]).map(humanize).join(", ") || "None"],
          [
            "Commitments",
            [
              commit.per_person?.length ? `per person ${commit.per_person.map((c) => formatCents(c)).join("/")}` : null,
              commit.lump_sum?.length ? `lump sum ${commit.lump_sum.map((c) => formatCents(c)).join("/")}` : null,
              commit.open ? "open amount" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Off",
          ],
          ["Lunch", event.lunch_enabled ? `${formatDateTime(event.lunch_starts_at, tz)} · ${event.lunch_slot_minutes}-min slots · ${event.lunch_seats_per_slot ?? "unlimited"} seats` : "Off"],
          ["Description", event.description ?? "—"],
        ]}
      />
    </Card>
  );
}
