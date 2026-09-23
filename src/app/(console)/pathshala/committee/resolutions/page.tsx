import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, EmptyState, Field, LoadProblem, NoAccess, PageHeader, Tabs } from "@/components/ui";
import { can } from "@/lib/access";
import { formatDate, todayIso } from "@/lib/format";
import { daysLeft, lifecycle } from "@/lib/logic/resolutions";
import { LIFECYCLE_TONE } from "../lifecycle-tone";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { saveResolution } from "../actions";

export const metadata: Metadata = { title: "Resolutions" };



export default async function ResolutionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!can(v.access, "governance.view", "governance.manage")) return <NoAccess area="committee resolutions" />;
  const sp = await searchParams;
  const showWithdrawn = sp.view === "withdrawn";
  const supabase = await getSupabase();
  const today = todayIso(v.center.time_zone);

  const res = await load(async () => {
    const list = rows(await supabase.from("resolutions").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }), "resolutions");
    const votes = list.length
      ? rows(await supabase.from("resolution_votes").select("resolution_id, vote").in("resolution_id", list.map((r) => r.id)), "votes")
      : [];
    return { list, votes };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const { list, votes } = res.data;
  const shown = list.filter((r) => (showWithdrawn ? r.withdrawn_at : !r.withdrawn_at));

  return (
    <>
      <PageHeader title="Resolutions" accent="pathshala" description="Comment period, then a vote. Quorum is 4 ballots (abstentions count); a resolution passes only when Yes outnumbers No." />
      <Tabs
        active={showWithdrawn ? "withdrawn" : "active"}
        tabs={[
          { key: "active", label: "Resolutions", href: "/pathshala/committee/resolutions" },
          { key: "withdrawn", label: "Withdrawn", href: "/pathshala/committee/resolutions?view=withdrawn" },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {shown.length === 0 ? (
            <EmptyState title="Nothing here yet" />
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => {
                const lc = lifecycle(r, votes.filter((x) => x.resolution_id === r.id));
                const open = r.voting_status === "started" ? r.voting_period : r.comment_status === "started" ? r.comment_period : null;
                const left = open ? daysLeft(open, today) : null;
                return (
                  <li key={r.id}>
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={LIFECYCLE_TONE[lc]}>{lc}</Badge>
                        {left !== null && (
                          <Badge tone={left < 0 ? "danger" : left <= 2 ? "danger" : left <= 5 ? "warning" : left <= 10 ? "caution" : "ok"}>
                            {left < 0 ? `Closed ${-left} days ago` : left === 0 ? "Closes today" : `${left} days left`}
                          </Badge>
                        )}
                      </div>
                      <Link href={`/pathshala/committee/resolutions/${r.id}`} className="mt-2 block font-display text-lg font-semibold text-navy hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted">Proposed {formatDate(r.created_at)}</p>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="lg:col-span-2">
          {can(v.access, "governance.manage") ? (
            <Card title="Propose a resolution">
              <ActionForm action={saveResolution.bind(null, null)} submitLabel="Create" submitClassName="btn btn-purple">
                <div className="space-y-3">
                  <Field label="Title">
                    <input name="title" required className="field-input" />
                  </Field>
                  <Field label="Resolution text">
                    <textarea name="description" rows={5} className="field-input" />
                  </Field>
                  <Field label="Why">
                    <textarea name="rationale" rows={3} className="field-input" />
                  </Field>
                  <Field label="Quorum (ballots needed)">
                    <input name="quorum" type="number" min={1} defaultValue={4} className="field-input" />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          ) : (
            <p className="text-sm text-muted">Committee chairs propose resolutions; members comment and vote.</p>
          )}
        </div>
      </div>
    </>
  );
}
