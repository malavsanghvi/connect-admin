import type { Metadata } from "next";
import { NoAccess } from "@/components/ui";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const v = await requireViewer();
  return (
    <NoAccess>
      You&apos;re signed in as {v.email ?? v.displayName}, but no Connect Admin role has been granted to you at {v.center.name}
      {v.personId ? "" : ", and this login isn't linked to a member record yet"}. Ask your center admin or the office to add
      the role you need (for example teacher, event lead or check-in volunteer).
    </NoAccess>
  );
}
