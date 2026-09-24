import { ActionForm } from "@/components/action-form";
import { Checkbox, Field, FormGrid, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { toDateTimeLocal } from "@/lib/format";
import { rows } from "@/lib/session";
import type { ServerSupabase } from "@/lib/supabase/server";
import { saveCampaign } from "./actions";
import { AudienceFields } from "./audience-fields";

export type AudienceOptions = { zones: { id: string; name: string }[]; classes: { id: string; name: string }[]; events: { id: string; name: string }[] };

export async function loadAudienceOptions(supabase: ServerSupabase, centerId: string): Promise<AudienceOptions> {
  const [zones, classes, events] = await Promise.all([
    supabase.from("zones").select("id, name").eq("center_id", centerId).order("name"),
    supabase.from("pathshala_classes").select("id, name").eq("center_id", centerId).order("name"),
    supabase.from("events").select("id, name").eq("center_id", centerId).order("starts_at", { ascending: false, nullsFirst: true }).limit(50),
  ]);
  // Classes and events are optional pickers: a comms officer without Pathshala access still composes.
  if (classes.error) console.error("[comms] class list unavailable", classes.error);
  if (events.error) console.error("[comms] event list unavailable", events.error);
  return { zones: rows(zones, "zones"), classes: classes.data ?? [], events: events.data ?? [] };
}

const CHANNEL_LABELS: [string, string][] = [
  ["push", "App notification"],
  ["email", "Email"],
  ["in_app", "In-app archive"],
  ["sms", "SMS"],
  ["whatsapp", "WhatsApp"],
];

export function CampaignForm({ campaign, options, tz }: { campaign: Tables<"comms_campaigns"> | null; options: AudienceOptions; tz: string }) {
  const channels = campaign?.channels ?? ["push", "email"];
  return (
    <ActionForm action={saveCampaign.bind(null, campaign?.id ?? null)} submitLabel={campaign ? "Save changes" : "Save draft"}>
      <div className="space-y-4">
        <FormGrid>
          <Field label="Type">
            <Select
              name="kind"
              defaultValue={campaign?.kind ?? "announcement"}
              options={[
                { value: "announcement", label: "Announcement" },
                { value: "newsletter", label: "Newsletter" },
                { value: "event", label: "Event" },
                { value: "pathshala_update", label: "Pathshala update" },
                { value: "appeal", label: "Appeal" },
              ]}
            />
          </Field>
          <Field label="Send at" hint="Leave blank to send as soon as it's approved">
            <input type="datetime-local" name="scheduled_at" defaultValue={toDateTimeLocal(campaign?.scheduled_at, tz)} className="field-input" />
          </Field>
        </FormGrid>
        <Field label="Title / subject">
          <input name="title" required defaultValue={campaign?.title ?? ""} className="field-input" />
        </Field>
        <Field label="Message">
          <textarea name="body_md" required rows={8} defaultValue={campaign?.body_md ?? ""} className="field-input" />
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Channels</legend>
          <div className="flex flex-wrap gap-x-6">
            {CHANNEL_LABELS.map(([v, l]) => (
              <Checkbox key={v} name="channels" value={v} label={l} defaultChecked={(channels as string[]).includes(v)} />
            ))}
          </div>
        </fieldset>
        <AudienceFields zones={options.zones} classes={options.classes} events={options.events} initial={campaign?.audience ?? { all_members: true }} />
      </div>
    </ActionForm>
  );
}
