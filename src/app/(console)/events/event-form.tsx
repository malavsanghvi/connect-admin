import { ActionForm } from "@/components/action-form";
import { PersonPicker } from "@/components/person-picker";
import { Checkbox, Field, FormGrid, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { centsToDollarsInput, toDateTimeLocal } from "@/lib/format";
import { createEvent, updateEvent } from "./actions";

type Commit = { per_person?: number[]; lump_sum?: number[]; open?: boolean };

function dollars(list: number[] | undefined) {
  return (list ?? []).map((c) => centsToDollarsInput(c)).join(", ");
}

export function EventForm({
  event,
  tz,
  owner,
}: {
  event: Tables<"events"> | null;
  tz: string;
  owner: { id: string; name: string; detail: string | null } | null;
}) {
  const flags = Array.isArray(event?.attendee_flags) ? (event!.attendee_flags as string[]) : ["child_under_12", "senior", "assistance"];
  const commit = (event?.commitment_options ?? { per_person: [300, 500, 700], lump_sum: [1000, 2500, 5000], open: true }) as Commit;
  const commitOn = Boolean((commit.per_person?.length ?? 0) + (commit.lump_sum?.length ?? 0) || commit.open);
  const prio = (event?.lunch_priority_rules ?? { family_with_child_under_12_at_start: true, senior_at_start: true }) as Record<string, boolean>;

  return (
    <ActionForm action={event ? updateEvent.bind(null, event.id) : createEvent} submitLabel={event ? "Save event" : "Create event"} submitClassName="btn btn-maroon">
      <div className="space-y-6">
        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Event</legend>
          <FormGrid>
            <Field label="Name" className="sm:col-span-2">
              <input name="name" required defaultValue={event?.name ?? ""} className="field-input" />
            </Field>
            <Field label="Starts">
              <input type="datetime-local" name="starts_at" defaultValue={toDateTimeLocal(event?.starts_at, tz)} className="field-input" />
            </Field>
            <Field label="Ends">
              <input type="datetime-local" name="ends_at" defaultValue={toDateTimeLocal(event?.ends_at, tz)} className="field-input" />
            </Field>
            <Field label="Venue">
              <input name="venue" defaultValue={event?.venue ?? ""} className="field-input" />
            </Field>
            <Field label="Pathshala year" hint="Only for Pathshala events, e.g. 2026-2027">
              <input name="program_year" defaultValue={event?.program_year ?? ""} className="field-input" />
            </Field>
            <Field label="Flyer" hint="Storage path or https:// link to the flyer image">
              <input name="flyer_path" defaultValue={event?.flyer_path ?? ""} className="field-input" />
            </Field>
            <PersonPicker name="owner_person_id" label="Owner (event lead)" initial={owner ? [owner] : []} />
            <Field label="Description" className="sm:col-span-2">
              <textarea name="description" rows={4} defaultValue={event?.description ?? ""} className="field-input" />
            </Field>
          </FormGrid>
          <Checkbox name="confidential" label="Confidential (committee only)" defaultChecked={event?.confidential ?? false} />
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Audience and RSVP</legend>
          <FormGrid>
            <Field label="Who can RSVP">
              <Select
                name="audience"
                defaultValue={event?.audience ?? "members_and_guests"}
                options={[
                  { value: "members_and_guests", label: "Members and guests" },
                  { value: "members_only", label: "Members only" },
                  { value: "life_members_only", label: "Life members only" },
                  { value: "pathshala_families", label: "Pathshala families" },
                  { value: "public", label: "Everyone (public)" },
                ]}
              />
            </Field>
            <Field label="Capacity" hint="Leave blank for no limit">
              <input type="number" name="capacity" min={0} defaultValue={event?.capacity ?? ""} className="field-input" />
            </Field>
            <Field label="RSVP opens">
              <input type="datetime-local" name="rsvp_opens_at" defaultValue={toDateTimeLocal(event?.rsvp_opens_at, tz)} className="field-input" />
            </Field>
            <Field label="RSVP closes">
              <input type="datetime-local" name="rsvp_closes_at" defaultValue={toDateTimeLocal(event?.rsvp_closes_at, tz)} className="field-input" />
            </Field>
            <Field label="Confirmation reminder (hours before)">
              <input type="number" name="confirmation_hours_before" min={0} defaultValue={event?.confirmation_hours_before ?? 24} className="field-input" />
            </Field>
          </FormGrid>
          <Checkbox name="waitlist_enabled" label="Waitlist when full (auto-offer freed seats)" defaultChecked={event?.waitlist_enabled ?? false} />
          <p className="mt-3 text-sm font-semibold">Ask about each attendee</p>
          <div className="flex flex-wrap gap-x-6">
            <Checkbox name="attendee_flags" value="child_under_12" label="Child under 12" defaultChecked={flags.includes("child_under_12")} />
            <Checkbox name="attendee_flags" value="senior" label="Senior" defaultChecked={flags.includes("senior")} />
            <Checkbox name="attendee_flags" value="assistance" label="Needs assistance" defaultChecked={flags.includes("assistance")} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Donation commitment at RSVP</legend>
          <Checkbox name="commitments_enabled" label="Offer commitment options" defaultChecked={commitOn} />
          <FormGrid>
            <Field label="Per person ($)" hint="Comma-separated, e.g. 3, 5, 7">
              <input name="commit_per_person" defaultValue={dollars(commit.per_person)} className="field-input" />
            </Field>
            <Field label="Lump sum ($)" hint="e.g. 10, 25, 50">
              <input name="commit_lump_sum" defaultValue={dollars(commit.lump_sum)} className="field-input" />
            </Field>
          </FormGrid>
          <Checkbox name="commit_open" label="Allow an open amount" defaultChecked={commit.open ?? true} />
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Lunch slots</legend>
          <Checkbox name="lunch_enabled" label="Assign lunch slots at check-in" defaultChecked={event?.lunch_enabled ?? false} />
          <FormGrid cols={3}>
            <Field label="Lunch starts">
              <input type="datetime-local" name="lunch_starts_at" defaultValue={toDateTimeLocal(event?.lunch_starts_at, tz)} className="field-input" />
            </Field>
            <Field label="Slot length (minutes)">
              <Select
                name="lunch_slot_minutes"
                defaultValue={String(event?.lunch_slot_minutes ?? 15)}
                options={[10, 15, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} min` }))}
              />
            </Field>
            <Field label="Seats per slot" hint="Blank = unlimited">
              <input type="number" name="lunch_seats_per_slot" min={1} defaultValue={event?.lunch_seats_per_slot ?? ""} className="field-input" />
            </Field>
          </FormGrid>
          <div className="flex flex-wrap gap-x-6">
            <Checkbox name="prio_child" label="Families with a child under 12 eat together at the first slot" defaultChecked={prio.family_with_child_under_12_at_start ?? true} />
            <Checkbox name="prio_senior" label="Seniors at the first slot" defaultChecked={prio.senior_at_start ?? true} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 font-display text-lg font-semibold">Tickets</legend>
          <Checkbox name="is_paid" label="Paid event" defaultChecked={event?.is_paid ?? false} />
          <FormGrid>
            <Field label="Member price ($)">
              <input name="member_price" inputMode="decimal" defaultValue={centsToDollarsInput(event?.member_price_cents)} className="field-input" />
            </Field>
            <Field label="Guest price ($)">
              <input name="guest_price" inputMode="decimal" defaultValue={centsToDollarsInput(event?.guest_price_cents)} className="field-input" />
            </Field>
          </FormGrid>
        </fieldset>
      </div>
    </ActionForm>
  );
}
