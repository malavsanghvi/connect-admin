import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ActionForm } from "@/components/action-form";
import { PersonPicker } from "@/components/person-picker";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, PageHeader, Select, TableWrap, Tabs, td, th } from "@/components/ui";
import { areas, can } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { resolvePeopleNames } from "@/lib/data/people";
import { addDays, formatDate, humanize, todayIso } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { addInterest, recordBackgroundCheck, saveGroup, setInterestStatus } from "./actions";

export const metadata: Metadata = { title: "Volunteers" };

type Payload =
  | { kind: "groups"; groups: Tables<"volunteer_groups">[]; interests: { group_id: string; status: string }[]; names: Map<string, string> }
  | { kind: "interests"; groups: Tables<"volunteer_groups">[]; interests: Tables<"volunteer_interests">[]; names: Map<string, string> }
  | { kind: "checks"; checks: Tables<"background_checks">[]; names: Map<string, string> };

function GroupFields({ g, coordinator }: { g: Tables<"volunteer_groups"> | null; coordinator: { id: string; name: string; detail: null } | null }) {
  return (
    <div className="space-y-3">
      <Field label="Name">
        <input name="name" required defaultValue={g?.name ?? ""} className="field-input" />
      </Field>
      <PersonPicker name="coordinator_person_id" label="Coordinator" initial={coordinator ? [coordinator] : []} />
      <Field label="Waiver required" hint="Legal document kind, e.g. volunteer_waiver">
        <input name="requires_waiver_kind" defaultValue={g?.requires_waiver_kind ?? ""} className="field-input" />
      </Field>
      <Checkbox name="requires_background_check" label="Background check required" defaultChecked={g?.requires_background_check ?? false} />
    </div>
  );
}

export default async function VolunteersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.volunteers(v.access)) return <NoAccess area="volunteers" />;
  const sp = await searchParams;
  const volunteerStaff = can(v.access, "volunteers.view", "volunteers.manage");
  const safety = can(v.access, "safety.view", "safety.manage");
  const tabs = [
    ...(volunteerStaff ? [{ key: "groups", label: "Groups" }, { key: "interests", label: "Volunteers" }] : []),
    ...(safety ? [{ key: "checks", label: "Background checks" }] : []),
  ];
  const tab = tabs.some((t) => t.key === sp.tab) ? String(sp.tab) : tabs[0].key;
  const groupFilter = typeof sp.group === "string" ? sp.group : null;
  const supabase = await getSupabase();
  const today = todayIso(v.center.time_zone);

  const res = await load(async (): Promise<Payload> => {
    if (tab === "checks") {
      const checks = rows(await supabase.from("background_checks").select("*").eq("center_id", v.center.id).order("expires_on", { ascending: true, nullsFirst: false }), "background checks");
      return { kind: "checks", checks, names: await resolvePeopleNames(supabase, checks.map((c) => c.person_id)) };
    }
    const groups = rows(await supabase.from("volunteer_groups").select("*").eq("center_id", v.center.id).order("name"), "volunteer groups");
    if (tab === "groups") {
      const interests = rows(await supabase.from("volunteer_interests").select("group_id, status").eq("center_id", v.center.id), "volunteer interests");
      return { kind: "groups", groups, interests, names: await resolvePeopleNames(supabase, groups.map((g) => g.coordinator_person_id)) };
    }
    let q = supabase.from("volunteer_interests").select("*").eq("center_id", v.center.id).order("created_at", { ascending: false }).limit(300);
    if (groupFilter) q = q.eq("group_id", groupFilter);
    const interests = rows(await q, "volunteers");
    return { kind: "interests", groups, interests, names: await resolvePeopleNames(supabase, interests.map((i) => i.person_id)) };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data;
  const manage = can(v.access, "volunteers.manage");

  return (
    <>
      <PageHeader title="Volunteers" description="Seva groups and coordinators, who has signed up, and background checks with expiry warnings." />
      <Tabs active={tab} tabs={tabs.map((t) => ({ ...t, href: `/volunteers?tab=${t.key}` }))} />

      {d.kind === "groups" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {d.groups.length === 0 && <EmptyState title="No groups yet" />}
            {d.groups.map((g) => {
              const mine = d.interests.filter((i) => i.group_id === g.id);
              return (
                <Card key={g.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/volunteers?tab=interests&group=${g.id}`} className="font-display text-lg font-semibold text-navy hover:underline">
                        {g.name}
                      </Link>
                      <p className="text-xs text-muted">
                        Coordinator: {g.coordinator_person_id ? (d.names.get(g.coordinator_person_id) ?? "assigned") : "not set"} · {mine.filter((i) => i.status === "active").length} active ·{" "}
                        {mine.filter((i) => i.status === "interested").length} interested
                      </p>
                    </div>
                    <span className="flex gap-1">
                      {g.requires_background_check && <Badge tone="warning">Background check</Badge>}
                      {g.requires_waiver_kind && <Badge tone="navy">Waiver</Badge>}
                    </span>
                  </div>
                  {manage && (
                    <div className="mt-3">
                      <Details summary="Edit group">
                        <ActionForm action={saveGroup.bind(null, g.id)} submitLabel="Save group">
                          <GroupFields
                            g={g}
                            coordinator={g.coordinator_person_id ? { id: g.coordinator_person_id, name: d.names.get(g.coordinator_person_id) ?? "Coordinator", detail: null } : null}
                          />
                        </ActionForm>
                      </Details>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {manage && (
            <Card title="New group">
              <ActionForm action={saveGroup.bind(null, null)} submitLabel="Add group" resetOnSuccess>
                <GroupFields g={null} coordinator={null} />
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {d.kind === "interests" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={groupFilter ? (d.groups.find((g) => g.id === groupFilter)?.name ?? "Group") : "All volunteers"}>
            <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="interests" />
              <select name="group" defaultValue={groupFilter ?? ""} className="field-input max-w-xs" aria-label="Group">
                <option value="">All groups</option>
                {d.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-secondary">
                Filter
              </button>
            </form>
            {d.interests.length === 0 ? (
              <EmptyState title="Nobody here yet" />
            ) : (
              <ul className="divide-y divide-line">
                {d.interests.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span>
                      <span className="font-semibold">{d.names.get(i.person_id) ?? "Volunteer"}</span>
                      <span className="text-xs text-muted"> · {d.groups.find((g) => g.id === i.group_id)?.name}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={i.status === "active" ? "success" : i.status === "interested" ? "warning" : "muted"}>{humanize(i.status)}</Badge>
                      {manage && i.status !== "active" && <ActionButton action={setInterestStatus.bind(null, i.id)} fields={{ status: "active" }} label="Make active" />}
                      {manage && i.status === "active" && <ActionButton action={setInterestStatus.bind(null, i.id)} fields={{ status: "inactive" }} label="Inactive" />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {manage && (
            <Card title="Add a volunteer">
              <ActionForm action={addInterest} submitLabel="Add" resetOnSuccess>
                <div className="space-y-3">
                  <PersonPicker name="person_id" label="Person" required />
                  <Field label="Group">
                    <Select name="group_id" required defaultValue={groupFilter} placeholder="Choose" options={d.groups.map((g) => ({ value: g.id, label: g.name }))} />
                  </Field>
                  <Field label="Status">
                    <Select
                      name="status"
                      defaultValue="active"
                      options={[
                        { value: "active", label: "Active" },
                        { value: "interested", label: "Interested" },
                      ]}
                    />
                  </Field>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {d.kind === "checks" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Background checks" className="lg:col-span-2">
            {d.checks.length === 0 ? (
              <EmptyState title="No checks recorded" />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className={th}>Person</th>
                      <th className={th}>Result</th>
                      <th className={th}>Cleared</th>
                      <th className={th}>Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.checks.map((c) => {
                      const expired = c.expires_on !== null && c.expires_on < today;
                      const soon = !expired && c.expires_on !== null && c.expires_on <= addDays(today, 30);
                      return (
                        <tr key={c.id}>
                          <td className={td}>{d.names.get(c.person_id) ?? "Volunteer"}</td>
                          <td className={td}>
                            <Badge tone={c.status === "clear" ? "success" : c.status === "flagged" ? "danger" : c.status === "expired" ? "muted" : "warning"}>{humanize(c.status)}</Badge>
                          </td>
                          <td className={td}>{formatDate(c.cleared_on)}</td>
                          <td className={td}>
                            {formatDate(c.expires_on)} {expired && <Badge tone="danger">Expired</Badge>}
                            {soon && <Badge tone="warning">Expires within 30 days</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
          {can(v.access, "safety.manage") && (
            <Card title="Record a check">
              <ActionForm action={recordBackgroundCheck} submitLabel="Record" resetOnSuccess>
                <div className="space-y-3">
                  <PersonPicker name="person_id" label="Person" required />
                  <Field label="Result">
                    <Select
                      name="status"
                      defaultValue="clear"
                      options={[
                        { value: "requested", label: "Requested" },
                        { value: "clear", label: "Clear" },
                        { value: "flagged", label: "Flagged" },
                        { value: "expired", label: "Expired" },
                      ]}
                    />
                  </Field>
                  <FormGrid>
                    <Field label="Cleared on">
                      <input type="date" name="cleared_on" className="field-input" />
                    </Field>
                    <Field label="Expires on">
                      <input type="date" name="expires_on" className="field-input" />
                    </Field>
                  </FormGrid>
                  <FormGrid>
                    <Field label="Provider">
                      <input name="provider" className="field-input" />
                    </Field>
                    <Field label="Reference">
                      <input name="provider_ref" className="field-input" />
                    </Field>
                  </FormGrid>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
