import { redirect } from "next/navigation";
import { LoadProblem } from "@/components/ui";
import { landingPath } from "@/lib/nav";
import { getViewer } from "@/lib/session";

// Send everyone to the screen they use most: teachers to My classes,
// check-in volunteers to their event's scanner, staff to their first area.
export default async function Home() {
  const res = await getViewer();
  if (res.status === "signed_out") redirect("/login");
  if (res.status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <LoadProblem message={res.error} />
      </main>
    );
  }
  redirect(landingPath(res.viewer.access, { checkinEventId: res.viewer.opsEventId }));
}
