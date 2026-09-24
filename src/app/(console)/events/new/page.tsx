import type { Metadata } from "next";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { can } from "@/lib/access";
import { requireViewer } from "@/lib/session";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const v = await requireViewer();
  if (!can(v.access, "events.manage")) return <NoAccess area="creating events" />;
  return (
    <>
      <PageHeader kicker="Events" accent="events" title="New event" back={{ href: "/events", label: "Events" }} description="Saved as a draft. Publish it from the event page when it's ready." />
      <Card>
        <EventForm event={null} tz={v.center.time_zone} owner={null} />
      </Card>
    </>
  );
}
