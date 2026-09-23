import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, DefinitionList, LoadProblem, NoAccess, PageHeader } from "@/components/ui";
import { areas } from "@/lib/access";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import { classDaysInTerm } from "@/lib/logic/attendance";
import { getSupabase, load, requireViewer, row } from "@/lib/session";
import { TermForm } from "../term-form";

export const metadata: Metadata = { title: "Edit term" };

export default async function TermPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="Pathshala terms" />;
  const supabase = await getSupabase();
  const res = await load(async () => row(await supabase.from("pathshala_terms").select("*").eq("id", id).maybeSingle(), "the term"));
  if (!res.ok) return <LoadProblem message={res.error} />;
  const term = res.data;
  if (!term) notFound();
  const tz = v.center.time_zone;
  const days = classDaysInTerm(term.starts_on, term.ends_on, "sunday", term.no_class_dates);

  return (
    <>
      <PageHeader kicker="Pathshala · Term" accent="pathshala" title={term.name} back={{ href: "/pathshala/terms", label: "All terms" }} />
      <Card title="Summary" className="mb-6">
        <DefinitionList
          items={[
            ["Dates", `${formatDate(term.starts_on)} – ${formatDate(term.ends_on)}`],
            ["Sunday classes", `${days.length} (after ${term.no_class_dates.length} no-class dates)`],
            ["Registration", `${formatDateTime(term.registration_opens_at, tz)} → ${formatDateTime(term.registration_closes_at, tz)}`],
            ["Fee per child", formatCents(term.fee_per_child_cents)],
            ["Sibling discount", `${term.sibling_discount_pct}%`],
            ["Family cap", term.fee_per_family_cap_cents === null ? "None" : formatCents(term.fee_per_family_cap_cents)],
            ["Membership required", term.membership_required ? "Yes" : "No"],
            ["Status", term.status],
          ]}
        />
      </Card>
      {areas.pathshalaManage(v.access) ? (
        <Card title="Edit term">
          <TermForm term={term} tz={tz} />
        </Card>
      ) : (
        <p className="text-sm text-muted">Only the Pathshala principal can edit terms.</p>
      )}
    </>
  );
}
