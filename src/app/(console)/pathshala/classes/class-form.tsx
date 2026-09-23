import { ActionForm } from "@/components/action-form";
import { Checkbox, Field, FormGrid, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import type { Level } from "@/lib/data/pathshala";
import { saveClass } from "../actions";

export function ClassForm({
  cls,
  terms,
  levels,
  defaultTermId,
}: {
  cls: Tables<"pathshala_classes"> | null;
  terms: { id: string; name: string }[];
  levels: Level[];
  defaultTermId: string | null;
}) {
  const grouped = new Map<string, Level[]>();
  for (const l of levels) grouped.set(l.track_name, [...(grouped.get(l.track_name) ?? []), l]);
  return (
    <ActionForm action={saveClass.bind(null, cls?.id ?? null)} submitLabel={cls ? "Save class" : "Create class"} resetOnSuccess={!cls} submitClassName="btn btn-purple">
      <FormGrid>
        <Field label="Term">
          <Select name="term_id" required defaultValue={cls?.term_id ?? defaultTermId} options={terms.map((t) => ({ value: t.id, label: t.name }))} placeholder="Choose a term" />
        </Field>
        <Field label="Level">
          <select name="level_id" required defaultValue={cls?.level_id ?? ""} className="field-input">
            <option value="">Choose a level</option>
            {[...grouped.entries()].map(([track, ls]) => (
              <optgroup key={track} label={track}>
                {ls.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Class name" hint="For example Jainism 3 – Room B">
          <input name="name" required defaultValue={cls?.name ?? ""} className="field-input" />
        </Field>
        <Field label="Room">
          <input name="room" defaultValue={cls?.room ?? ""} className="field-input" />
        </Field>
        <Field label="Capacity" hint="Leave blank for no limit">
          <input name="capacity" type="number" min={0} defaultValue={cls?.capacity ?? ""} className="field-input" />
        </Field>
        <Field label="Meets on">
          <Select
            name="meets_on"
            defaultValue={cls?.meets_on ?? "sunday"}
            options={["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))}
          />
        </Field>
        <Field label="Starts">
          <input type="time" name="starts_time" defaultValue={cls?.starts_time?.slice(0, 5) ?? ""} className="field-input" />
        </Field>
        <Field label="Ends">
          <input type="time" name="ends_time" defaultValue={cls?.ends_time?.slice(0, 5) ?? ""} className="field-input" />
        </Field>
        <Field label="Class email (role mailbox)">
          <input type="email" name="class_email" defaultValue={cls?.class_email ?? ""} className="field-input" />
        </Field>
      </FormGrid>
      <Checkbox name="waitlist_enabled" label="Waitlist when full" defaultChecked={cls?.waitlist_enabled ?? true} />
    </ActionForm>
  );
}
