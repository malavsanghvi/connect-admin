// What this app calls the modules in its navigation and page headings. The words come from the community's kind
// (app.category_profile): a community that has a school names it, and one that does not gets neutral wording. Pure: no
// server imports.

import { kindName, moduleNotOffered, type KindProfile } from "@/lib/kind";

export type ModuleLabels = {
  /** The school or learning module's name: the section heading and kicker of its pages. */
  school: string;
  /** The sign-offs page: "<learning path> sign-offs", or "Sign-offs". */
  signoffs: string;
  /** The in-person pledge event module. */
  pledges: string;
  /** The store module. */
  store: string;
};

/** The neutral wording used for a module the community's kind does not offer, or cannot be read. */
export const NEUTRAL_LABELS: ModuleLabels = { school: "Learning", signoffs: "Sign-offs", pledges: "Event pledges", store: "Store" };

/**
 * The catalog's own name for a module that a kind offers but has not renamed (the same names connect-crm's module
 * registry gives them). They are used only when the community's kind offers the module and gives it no name.
 */
const CATALOG = { school: "Pathshala", pledges: "Bolis" } as const;

export function moduleLabels(kind: Pick<KindProfile, "modules" | "terms">): ModuleLabels {
  const learning = kindName(kind, "gyan_path", "");
  return {
    school: kindName(kind, "pathshala", moduleNotOffered(kind, "pathshala") ? NEUTRAL_LABELS.school : CATALOG.school),
    signoffs: learning ? `${learning} sign-offs` : NEUTRAL_LABELS.signoffs,
    pledges: kindName(kind, "bolis", moduleNotOffered(kind, "bolis") ? NEUTRAL_LABELS.pledges : CATALOG.pledges),
    store: kindName(kind, "store", NEUTRAL_LABELS.store),
  };
}
