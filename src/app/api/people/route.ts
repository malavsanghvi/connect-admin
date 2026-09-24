import { NextResponse, type NextRequest } from "next/server";
import { searchPeople } from "@/lib/data/people";
import { getSupabase, getViewer } from "@/lib/session";

// People search for pickers. Runs as the signed-in user, so RLS decides who
// can be found (staff with people.view see everyone; others see less).
export async function GET(request: NextRequest) {
  const res = await getViewer();
  if (res.status === "signed_out") return NextResponse.json({ ok: false, error: "Your session has ended. Sign in again." }, { status: 401 });
  if (res.status === "error") return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const supabase = await getSupabase();
  const { people, error } = await searchPeople(supabase, res.viewer.center.id, q);
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });
  return NextResponse.json({ ok: true, people });
}
