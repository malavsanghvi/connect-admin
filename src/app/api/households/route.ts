import { NextResponse, type NextRequest } from "next/server";
import { getSupabase, getViewer } from "@/lib/session";

// Household search for pickers (in-person boli pledges, etc.). RLS limits
// results to staff with people.view (or a zone lead's own zone).
export async function GET(request: NextRequest) {
  const res = await getViewer();
  if (res.status === "signed_out") return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  if (res.status === "error") return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().replace(/[%,()*]/g, " ");
  if (q.length < 2) return NextResponse.json({ ok: true, people: [] });
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("households")
    .select("id, display_name, household_number, city")
    .eq("center_id", res.viewer.center.id)
    .is("merged_into_id", null)
    .or(`display_name.ilike.%${q}%,household_number.ilike.%${q}%`)
    .limit(20);
  if (error) {
    console.error("[api/households] search failed", error);
    return NextResponse.json({ ok: false, error: "The household search failed. Try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    people: (data ?? []).map((h) => ({ id: h.id, name: h.display_name, detail: [h.household_number, h.city].filter(Boolean).join(" · ") || null })),
  });
}
