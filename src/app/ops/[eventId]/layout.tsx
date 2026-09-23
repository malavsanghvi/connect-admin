import Link from "next/link";
import { redirect } from "next/navigation";
import { LoadProblem } from "@/components/ui";
import { getSupabase, getViewer } from "@/lib/session";

// Phone-first "volunteer mode": no console chrome, big targets, dark header.
export default async function OpsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const res = await getViewer();
  if (res.status === "signed_out") redirect(`/login?next=/ops/${eventId}/checkin`);
  if (res.status === "error") {
    return (
      <main className="mx-auto max-w-xl px-4 py-8">
        <LoadProblem message={res.error} />
      </main>
    );
  }
  const supabase = await getSupabase();
  const { data: event, error } = await supabase.from("events").select("name").eq("id", eventId).maybeSingle();
  if (error) console.error("[ops] event name unavailable", error);
  return (
    <div className="min-h-screen bg-[#EDE6DA]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-navy px-4 py-2 text-white">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#D7A15F]">Volunteer mode</p>
          <p className="truncate font-display text-lg font-semibold">{event?.name ?? "Event"}</p>
        </div>
        <Link href="/" className="btn min-h-11 border border-white/40 px-4 text-white">
          Exit
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-4 py-4">{children}</main>
    </div>
  );
}
