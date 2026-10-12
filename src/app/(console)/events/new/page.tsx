import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { can } from "@/lib/access";
import { portalUrl } from "@/lib/env";
import { portalNewEventLink } from "@/lib/logic/portal-links";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "New event" };

let loggedNoPortalUrl = false;

/** Once per server process: the card names the portal page in plain text instead of linking to it. */
function noteNoPortalUrl() {
  if (loggedNoPortalUrl) return;
  loggedNoPortalUrl = true;
  console.warn(
    `[events.new] NEXT_PUBLIC_PORTAL_URL ${process.env.NEXT_PUBLIC_PORTAL_URL ? "is not an http(s) URL" : "is not set"}, so the New event page names the portal's event creator instead of linking to it. Set the repository variable PORTAL_PUBLIC_URL in connect-admin and redeploy.`,
  );
}

/**
 * Events are created in the Weaver portal's guided event creator (connect-crm /events/new); this console
 * is for the day of the event. The route stays so bookmarks and old links land on this explanation.
 */
export default async function NewEventPage() {
  const v = await requireViewer();
  if (!can(v.access, "events.manage")) return <NoAccess area="creating events" />;
  const link = portalNewEventLink(portalUrl());
  if (!link) noteNoPortalUrl();
  return (
    <>
      <PageHeader kicker="Events" accent="events" title="New event" back={{ href: "/events", label: "Events" }} />
      <Card title="Create events in the Weaver portal">
        <div className="max-w-2xl space-y-3 text-sm">
          <p>
            New events are now created in the Weaver portal. It walks you through the whole event in one place: the basics, who can RSVP, money, helpers, reminders and the flyer, and it only
            publishes when you approve.
          </p>
          <p className="text-muted">
            This console is for the day of the event: check-in, the live event, lunch slots, volunteers and the report. To change the details of an event that already exists, open it from
            Events.
          </p>
          <p className="text-muted">
            Two choices are still made here, on an event&apos;s Details tab after you create it: opening the event to everyone (public), and which families and seniors eat at the first lunch
            slot.
          </p>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-maroon">
              Create an event in the Weaver portal
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p className="rounded-lg border border-line bg-white p-3">
              To create an event: open the Weaver portal › Events › New event. This console does not have the portal&apos;s address yet, so it cannot link there. Ask the person who
              looks after Weaver to set it up.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
