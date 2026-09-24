import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, LoadProblem, NoAccess, PageHeader, TableWrap, td, th } from "@/components/ui";
import { areas } from "@/lib/access";
import { loadTerms } from "@/lib/data/pathshala";
import { formatCents, formatDate, formatDateTime } from "@/lib/format";
import { getSupabase, load, requireViewer } from "@/lib/session";
import { TermForm } from "./term-form";

export const metadata: Metadata = { title: "Pathshala terms" };

const statusTone = { draft: "muted", registration: "navy", active: "success", closed: "neutral" } as const;

export default async function TermsPage() {
  const v = await requireViewer();
  if (!areas.pathshalaAdmin(v.access)) return <NoAccess area="Pathshala terms" />;
  const supabase = await getSupabase();
  const res = await load(() => loadTerms(supabase, v.center.id));
  if (!res.ok) return <LoadProblem message={res.error} />;
  const canEdit = areas.pathshalaManage(v.access);
  const tz = v.center.time_zone;

  return (
    <>
      <PageHeader kicker="Pathshala" accent="pathshala" title="Terms" description="Dates, registration window, fees and no-class days for each Pathshala year." />
      <Card title="All terms" className="mb-6">
        {res.data.length === 0 ? (
          <EmptyState title="No terms yet">{canEdit ? "Create one below." : "The principal hasn't set one up yet."}</EmptyState>
        ) : (
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Term</th>
                  <th className={th}>Dates</th>
                  <th className={th}>Registration</th>
                  <th className={th}>Fees</th>
                  <th className={th}>No class</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((t) => (
                  <tr key={t.id}>
                    <td className={td}>
                      <Link className="font-semibold text-navy hover:underline" href={`/pathshala/terms/${t.id}`}>
                        {t.name}
                      </Link>
                    </td>
                    <td className={td}>
                      {formatDate(t.starts_on)} – {formatDate(t.ends_on)}
                    </td>
                    <td className={td}>
                      {t.registration_opens_at ? formatDateTime(t.registration_opens_at, tz) : "—"}
                      <br />
                      <span className="text-muted">to {t.registration_closes_at ? formatDateTime(t.registration_closes_at, tz) : "—"}</span>
                    </td>
                    <td className={td}>
                      {formatCents(t.fee_per_child_cents)} per child
                      {t.sibling_discount_pct > 0 && <div className="text-xs text-muted">{t.sibling_discount_pct}% sibling discount</div>}
                      {t.fee_per_family_cap_cents !== null && <div className="text-xs text-muted">cap {formatCents(t.fee_per_family_cap_cents)}</div>}
                    </td>
                    <td className={td}>{t.no_class_dates.length}</td>
                    <td className={td}>
                      <Badge tone={statusTone[t.status as keyof typeof statusTone] ?? "neutral"}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      {canEdit && (
        <Card title="New term">
          <TermForm term={null} tz={tz} />
        </Card>
      )}
    </>
  );
}
