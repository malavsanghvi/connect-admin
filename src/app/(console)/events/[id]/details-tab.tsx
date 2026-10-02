import { RetryButton } from "@/components/retry-button";
import { Card, DefinitionList } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { portalUrl } from "@/lib/env";
import { formatCents, formatDateTime, humanize } from "@/lib/format";
import { FLYER_LINK_SECONDS, flyerSourceLabel, portalFlyerLink, type FlyerView } from "@/lib/logic/event-flyer";
import { EventForm } from "../event-form";

let loggedNoPortalUrl = false;

/** Once per server process: the flyer card names the portal page in plain text instead of linking to it. */
function noteNoPortalUrl() {
  if (loggedNoPortalUrl) return;
  loggedNoPortalUrl = true;
  console.warn(
    `[events.flyer] NEXT_PUBLIC_PORTAL_URL ${process.env.NEXT_PUBLIC_PORTAL_URL ? "is not an http(s) URL" : "is not set"}, so the Flyer card names the portal's flyer maker instead of linking to it. Set the repository variable PORTAL_PUBLIC_URL in connect-admin and redeploy.`,
  );
}

/**
 * The current flyer, read-only. It is made and changed only in the portal's flyer maker
 * (connect-crm), which owns events.flyer_*; this card never uploads, renders or generates one.
 */
function FlyerCard({ event, flyer, canEdit }: { event: Tables<"events">; flyer: FlyerView; canEdit: boolean }) {
  const hasFlyer = Boolean(event.flyer_path?.trim());
  const label = hasFlyer ? flyerSourceLabel(event.flyer_source) : null;
  const link = canEdit ? portalFlyerLink(portalUrl(), event.id) : null;
  if (canEdit && !link) noteNoPortalUrl();
  return (
    <Card id="flyer" title="Flyer" className="self-start">
      {flyer.error && (
        <div role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <p>{flyer.error}</p>
          {flyer.retry !== false && (
            <div className="mt-2">
              <RetryButton />
            </div>
          )}
        </div>
      )}
      {flyer.url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flyer.url} alt={`Flyer for ${event.name}`} className="w-full rounded-lg border border-line" />
          {flyer.signed && (
            <p className="mt-2 text-xs text-muted">
              This preview link works for {Math.round(FLYER_LINK_SECONDS / 60)} minutes. If the image stops showing, reload the page.
            </p>
          )}
        </>
      ) : (
        !hasFlyer && <p className="text-sm text-muted">No flyer yet.</p>
      )}
      {label && <p className="mt-2 text-sm text-muted">{label}</p>}
      {canEdit &&
        (link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-3">
            Make or change the flyer in the portal
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <p className="mt-3 text-sm text-muted">
            To make or change the flyer: Open the Community Connect portal › Events › this event › Event builder › Flyer maker
          </p>
        ))}
    </Card>
  );
}

export function DetailsTab({
  event,
  canEdit,
  tz,
  ownerName,
  flyer,
}: {
  event: Tables<"events">;
  canEdit: boolean;
  tz: string;
  ownerName: string | null;
  flyer: FlyerView;
}) {
  const commit = event.commitment_options as { per_person?: number[]; lump_sum?: number[]; open?: boolean };
  if (canEdit) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <EventForm event={event} tz={tz} owner={event.owner_person_id ? { id: event.owner_person_id, name: ownerName ?? "Event lead", detail: null } : null} />
        </Card>
        <FlyerCard event={event} flyer={flyer} canEdit />
      </div>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
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
      <FlyerCard event={event} flyer={flyer} canEdit={false} />
    </div>
  );
}
