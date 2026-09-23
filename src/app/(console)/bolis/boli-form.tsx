import { ActionForm } from "@/components/action-form";
import { Checkbox, Field, FormGrid, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { centsToDollarsInput, toDateTimeLocal } from "@/lib/format";
import { saveBoli } from "./actions";

export function BoliForm({ boli, events, tz }: { boli: Tables<"bolis"> | null; events: { id: string; name: string }[]; tz: string }) {
  return (
    <ActionForm action={saveBoli.bind(null, boli?.id ?? null)} submitLabel={boli ? "Save boli" : "Create boli"} submitClassName="btn btn-maroon">
      <FormGrid>
        <Field label="Item" className="sm:col-span-2" hint="e.g. First aarti on Samvatsari">
          <input name="name" required defaultValue={boli?.name ?? ""} className="field-input" />
        </Field>
        <Field label="Kind">
          <Select
            name="kind"
            defaultValue={boli?.kind ?? "digital"}
            options={[
              { value: "digital", label: "Digital (members pledge in the app)" },
              { value: "in_person", label: "In person (recorded in the hall)" },
            ]}
          />
        </Field>
        <Field label="Event">
          <Select name="event_id" defaultValue={boli?.event_id ?? ""} placeholder="No event" options={events.map((e) => ({ value: e.id, label: e.name }))} />
        </Field>
        <Field label="Starting pledge ($)">
          <input name="floor" inputMode="decimal" defaultValue={centsToDollarsInput(boli?.floor_cents ?? 0)} className="field-input" />
        </Field>
        <Field label="Each new pledge must beat the top by ($)">
          <input name="step" inputMode="decimal" defaultValue={centsToDollarsInput(boli?.step_cents ?? 2100)} className="field-input" />
        </Field>
        <Field label="Opens">
          <input type="datetime-local" name="opens_at" defaultValue={toDateTimeLocal(boli?.opens_at, tz)} className="field-input" />
        </Field>
        <Field label="Closes">
          <input type="datetime-local" name="closes_at" defaultValue={toDateTimeLocal(boli?.closes_at, tz)} className="field-input" />
        </Field>
        <Field label="Extend when a pledge comes in the last … minutes" hint="0 = no extension">
          <input type="number" name="soft_close_minutes" min={0} defaultValue={boli?.soft_close_minutes ?? 0} className="field-input" />
        </Field>
        <Field label="Explainer video link">
          <input name="explainer_video_url" defaultValue={boli?.explainer_video_url ?? ""} className="field-input" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea name="description" rows={2} defaultValue={boli?.description ?? ""} className="field-input" />
        </Field>
        <Field label="Explainer (what this labh means)" className="sm:col-span-2">
          <textarea name="explainer_md" rows={3} defaultValue={boli?.explainer_md ?? ""} className="field-input" />
        </Field>
      </FormGrid>
      <Checkbox name="keep_all_entries" label="Keep every pledge (the center can accommodate all interested families)" defaultChecked={boli?.keep_all_entries ?? true} />
    </ActionForm>
  );
}
