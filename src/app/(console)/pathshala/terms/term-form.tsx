import { ActionForm } from "@/components/action-form";
import { Checkbox, Field, FormGrid, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { centsToDollarsInput, toDateTimeLocal } from "@/lib/format";
import { saveTerm } from "../actions";

export function TermForm({ term, tz }: { term: Tables<"pathshala_terms"> | null; tz: string }) {
  return (
    <ActionForm
      action={saveTerm.bind(null, term?.id ?? null)}
      submitLabel={term ? "Save term" : "Create term"}
      resetOnSuccess={!term}
      submitClassName="btn btn-purple"
    >
      <FormGrid>
        <Field label="Term name" hint="For example 2026-2027">
          <input name="name" required defaultValue={term?.name ?? ""} className="field-input" />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={term?.status ?? "draft"}
            options={[
              { value: "draft", label: "Draft (hidden from families)" },
              { value: "registration", label: "Registration open" },
              { value: "active", label: "Active (classes running)" },
              { value: "closed", label: "Closed" },
            ]}
          />
        </Field>
        <Field label="First day">
          <input type="date" name="starts_on" required defaultValue={term?.starts_on ?? ""} className="field-input" />
        </Field>
        <Field label="Last day">
          <input type="date" name="ends_on" required defaultValue={term?.ends_on ?? ""} className="field-input" />
        </Field>
        <Field label="Registration opens">
          <input type="datetime-local" name="registration_opens_at" defaultValue={toDateTimeLocal(term?.registration_opens_at, tz)} className="field-input" />
        </Field>
        <Field label="Registration closes">
          <input type="datetime-local" name="registration_closes_at" defaultValue={toDateTimeLocal(term?.registration_closes_at, tz)} className="field-input" />
        </Field>
        <Field label="Fee per child ($)" hint="Billed per child as a pledge">
          <input name="fee_per_child" inputMode="decimal" defaultValue={centsToDollarsInput(term?.fee_per_child_cents ?? 0)} className="field-input" />
        </Field>
        <Field label="Family cap ($)" hint="Leave blank for no cap">
          <input name="fee_family_cap" inputMode="decimal" defaultValue={centsToDollarsInput(term?.fee_per_family_cap_cents)} className="field-input" />
        </Field>
        <Field label="Sibling discount (%)">
          <input name="sibling_discount_pct" type="number" min={0} max={100} defaultValue={term?.sibling_discount_pct ?? 0} className="field-input" />
        </Field>
        <Field label="No-class dates" hint="One date per line (YYYY-MM-DD). Dates outside the term are ignored.">
          <textarea name="no_class_dates" rows={4} defaultValue={(term?.no_class_dates ?? []).join("\n")} className="field-input font-mono" />
        </Field>
      </FormGrid>
      <Checkbox name="membership_required" label="Membership required to register" defaultChecked={term?.membership_required ?? true} />
    </ActionForm>
  );
}
