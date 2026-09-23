import type { Metadata } from "next";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Details, EmptyState, Field, FormGrid, LoadProblem, NoAccess, Notice, PageHeader, Select, TableWrap, Tabs, td, th } from "@/components/ui";
import { areas, can } from "@/lib/access";
import type { Tables } from "@/lib/database.types";
import { addDays, formatDate, formatDateTime, humanize, todayIso } from "@/lib/format";
import { getSupabase, load, requireViewer, rows } from "@/lib/session";
import { deleteCalendarEntry, moderatePhoto, saveCalendarEntry, saveGuideSection, savePractice, saveTimings } from "./actions";

export const metadata: Metadata = { title: "Content" };

const TABS = [
  { key: "guide", label: "Guide" },
  { key: "practices", label: "Practices" },
  { key: "timings", label: "Daily timings" },
  { key: "calendar", label: "Calendar" },
  { key: "photos", label: "Photo queue" },
] as const;

function GuideFields({ s }: { s: Tables<"guide_sections"> | null }) {
  return (
    <>
      <FormGrid>
        <Field label="Title">
          <input name="title" required defaultValue={s?.title ?? ""} className="field-input" />
        </Field>
        <Field label="Web address (slug)">
          <input name="slug" required defaultValue={s?.slug ?? ""} pattern="[a-z0-9-]+" className="field-input" />
        </Field>
        <Field label="Order">
          <input name="sort_order" type="number" defaultValue={s?.sort_order ?? 0} className="field-input" />
        </Field>
      </FormGrid>
      <Field label="Text (Markdown)" className="mt-3">
        <textarea name="body_md" required rows={8} defaultValue={s?.body_md ?? ""} className="field-input font-mono text-sm" />
      </Field>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox name="public" label="Visible to guests" defaultChecked={s?.public ?? true} />
        <Checkbox name="is_checklist" label="Show as a checklist" defaultChecked={s?.is_checklist ?? false} />
      </div>
    </>
  );
}

function PracticeFields({ p }: { p: Tables<"practices"> | null }) {
  return (
    <>
      <FormGrid cols={3}>
        <Field label="Name">
          <input name="name" required defaultValue={p?.name ?? ""} className="field-input" />
        </Field>
        <Field label="Key" hint="Short id, e.g. samayik">
          <input name="key" required defaultValue={p?.key ?? ""} className="field-input" />
        </Field>
        <Field label="Category" hint="e.g. tapasya_pachchakhan">
          <input name="category" required defaultValue={p?.category ?? ""} className="field-input" />
        </Field>
        <Field label="Minutes">
          <input name="default_minutes" type="number" min={0} defaultValue={p?.default_minutes ?? ""} className="field-input" />
        </Field>
        <Field label="Points">
          <input name="points" type="number" min={0} defaultValue={p?.points ?? 1} className="field-input" />
        </Field>
        <Field label="Order">
          <input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} className="field-input" />
        </Field>
      </FormGrid>
      <Field label="Description" className="mt-3">
        <input name="description" defaultValue={p?.description ?? ""} className="field-input" />
      </Field>
      <Checkbox name="active" label="Active" defaultChecked={p?.active ?? true} />
    </>
  );
}

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer();
  if (!areas.content(v.access)) return <NoAccess area="content" />;
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? String(sp.tab) : "guide";
  const manage = can(v.access, "content.manage");
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const today = todayIso(tz);

  const res = await load(async () => {
    if (tab === "guide") return { guide: rows(await supabase.from("guide_sections").select("*").eq("center_id", v.center.id).order("sort_order"), "guide sections") };
    if (tab === "practices")
      return {
        practices: rows(
          await supabase.from("practices").select("*").or(`center_id.eq.${v.center.id},center_id.is.null`).order("category").order("sort_order"),
          "practices",
        ),
      };
    if (tab === "timings")
      return {
        timings: rows(
          await supabase.from("daily_timings").select("*").eq("center_id", v.center.id).gte("on_date", today).lte("on_date", addDays(today, 30)).order("on_date"),
          "daily timings",
        ),
      };
    if (tab === "calendar") {
      const layers = rows(await supabase.from("calendar_layers").select("*").or(`center_id.eq.${v.center.id},center_id.is.null`).order("name"), "calendar layers");
      const mine = layers.filter((l) => l.center_id === v.center.id);
      const entries = mine.length
        ? rows(
            await supabase.from("calendar_entries").select("*").in("layer_id", mine.map((l) => l.id)).gte("starts_on", addDays(today, -7)).order("starts_on").limit(200),
            "calendar entries",
          )
        : [];
      return { layers, entries };
    }
    return {
      photos: rows(await supabase.from("photos").select("*").eq("center_id", v.center.id).eq("status", "pending").order("created_at").limit(100), "photos awaiting review"),
    };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  const d = res.data as {
    guide?: Tables<"guide_sections">[];
    practices?: Tables<"practices">[];
    timings?: Tables<"daily_timings">[];
    layers?: Tables<"calendar_layers">[];
    entries?: Tables<"calendar_entries">[];
    photos?: Tables<"photos">[];
  };

  return (
    <>
      <PageHeader title="Content" description="New to JSH guide, practices catalog, daily timings, calendar and member photo moderation." />
      <Tabs active={tab} tabs={TABS.map((t) => ({ key: t.key, label: t.label, href: `/content?tab=${t.key}` }))} />
      {!manage && <div className="mb-4"><Notice>Your role can draft content items but not edit these areas. Ask a content manager.</Notice></div>}

      {tab === "guide" && d.guide && (
        <div className="space-y-4">
          {d.guide.length === 0 && <EmptyState title="No guide sections" />}
          {d.guide.map((s) => (
            <Card key={s.id} title={s.title} description={`/${s.slug} · ${s.public ? "public" : "members only"}${s.is_checklist ? " · checklist" : ""}`}>
              <p className="line-clamp-3 whitespace-pre-line text-sm text-muted">{s.body_md}</p>
              {manage && (
                <div className="mt-3">
                  <Details summary="Edit">
                    <ActionForm action={saveGuideSection.bind(null, s.id)} submitLabel="Save section">
                      <GuideFields s={s} />
                    </ActionForm>
                  </Details>
                </div>
              )}
            </Card>
          ))}
          {manage && (
            <Card title="New section">
              <ActionForm action={saveGuideSection.bind(null, null)} submitLabel="Add section" resetOnSuccess>
                <GuideFields s={null} />
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {tab === "practices" && d.practices && (
        <div className="space-y-4">
          <Card title="Practices" description="Shared tradition practices are read-only here; add your center's own below.">
            <ul className="divide-y divide-line">
              {d.practices.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      <span className="font-semibold">{p.name}</span> <span className="text-xs text-muted">· {humanize(p.category)} · {p.points} pts{p.default_minutes ? ` · ${p.default_minutes} min` : ""}</span>
                    </p>
                    <span className="flex gap-1">
                      {p.center_id === null && <Badge tone="muted">Shared</Badge>}
                      {!p.active && <Badge tone="warning">Inactive</Badge>}
                    </span>
                  </div>
                  {manage && p.center_id !== null && (
                    <div className="mt-2">
                      <Details summary="Edit">
                        <ActionForm action={savePractice.bind(null, p.id)} submitLabel="Save practice">
                          <PracticeFields p={p} />
                        </ActionForm>
                      </Details>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {manage && (
            <Card title="New practice">
              <ActionForm action={savePractice.bind(null, null)} submitLabel="Add practice" resetOnSuccess>
                <PracticeFields p={null} />
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {tab === "timings" && d.timings && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Next 30 days" className="lg:col-span-2">
            {d.timings.length === 0 ? (
              <EmptyState title="No timings entered" />
            ) : (
              <TableWrap>
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      {["Date", "Sunrise", "Navkarsi", "Sunset", "Chauvihar", "Aarti", "Temple"].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.timings.map((t) => (
                      <tr key={t.id}>
                        <td className={td}>{formatDate(t.on_date)}</td>
                        <td className={td}>{t.sunrise?.slice(0, 5) ?? "—"}</td>
                        <td className={td}>{t.navkarsi?.slice(0, 5) ?? "—"}</td>
                        <td className={td}>{t.sunset?.slice(0, 5) ?? "—"}</td>
                        <td className={td}>{t.chauvihar?.slice(0, 5) ?? "—"}</td>
                        <td className={td}>{t.aarti?.slice(0, 5) ?? "—"}</td>
                        <td className={td}>
                          {t.temple_open?.slice(0, 5) ?? "—"}–{t.temple_close?.slice(0, 5) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
          {manage && (
            <Card title="Enter timings for a day" description="Saving a date that already has timings replaces them.">
              <ActionForm action={saveTimings} submitLabel="Save timings">
                <div className="space-y-3">
                  <Field label="Date">
                    <input type="date" name="on_date" required defaultValue={today} className="field-input" />
                  </Field>
                  <FormGrid>
                    {[
                      ["sunrise", "Sunrise"],
                      ["navkarsi", "Navkarsi"],
                      ["sunset", "Sunset"],
                      ["chauvihar", "Chauvihar"],
                      ["aarti", "Aarti"],
                      ["temple_open", "Temple opens"],
                      ["temple_close", "Temple closes"],
                    ].map(([name, label]) => (
                      <Field key={name} label={label}>
                        <input type="time" name={name} className="field-input" />
                      </Field>
                    ))}
                  </FormGrid>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {tab === "calendar" && d.layers && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Upcoming entries" className="lg:col-span-2">
            {(d.entries ?? []).length === 0 ? (
              <EmptyState title="No entries on your center's layers" />
            ) : (
              <ul className="divide-y divide-line">
                {(d.entries ?? []).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{e.title}</span>{" "}
                      <span className="text-sm text-muted">
                        · {formatDate(e.starts_on)}
                        {e.ends_on && e.ends_on !== e.starts_on ? ` – ${formatDate(e.ends_on)}` : ""} · {d.layers!.find((l) => l.id === e.layer_id)?.name}
                      </span>
                    </span>
                    {manage && !e.event_id && <ActionButton action={deleteCalendarEntry.bind(null, e.id)} label="Remove" className="btn btn-danger" confirm={`Remove "${e.title}"?`} />}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Layers: {d.layers.map((l) => `${l.name}${l.center_id ? "" : " (shared)"}`).join(", ")}</p>
          </Card>
          {manage && (
            <Card title="Add an entry">
              <ActionForm action={saveCalendarEntry} submitLabel="Add" resetOnSuccess>
                <div className="space-y-3">
                  <Field label="Layer">
                    <Select name="layer_id" required placeholder="Choose" options={d.layers.filter((l) => l.center_id).map((l) => ({ value: l.id, label: l.name }))} />
                  </Field>
                  <Field label="Title">
                    <input name="title" required className="field-input" />
                  </Field>
                  <FormGrid>
                    <Field label="Date">
                      <input type="date" name="starts_on" required className="field-input" />
                    </Field>
                    <Field label="Until (optional)">
                      <input type="date" name="ends_on" className="field-input" />
                    </Field>
                  </FormGrid>
                </div>
              </ActionForm>
            </Card>
          )}
        </div>
      )}

      {tab === "photos" && d.photos && (
        <Card title="Awaiting review" description="Photos members upload stay hidden until approved. Photos with children need extra care.">
          {d.photos.length === 0 ? (
            <EmptyState title="Nothing to review" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.photos.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-3">
                  <p className="break-all text-xs text-muted">{p.storage_path}</p>
                  {p.caption && <p className="mt-1 text-sm">{p.caption}</p>}
                  <p className="mt-1 text-xs text-muted">Uploaded {formatDateTime(p.created_at, tz)}</p>
                  {p.contains_children && (
                    <p className="mt-1">
                      <Badge tone="warning">Contains children</Badge>
                    </p>
                  )}
                  {manage && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ActionButton action={moderatePhoto.bind(null, p.id)} fields={{ status: "approved" }} label="Approve" className="btn btn-success" />
                      <ActionButton action={moderatePhoto.bind(null, p.id)} fields={{ status: "rejected" }} label="Reject" className="btn btn-danger" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
