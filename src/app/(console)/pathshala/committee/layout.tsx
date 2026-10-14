import { moduleLabels } from "@/lib/labels";
import { requireViewer } from "@/lib/session";
import { CommitteeTabs } from "./committee-tabs";

export default async function CommitteeLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  return (
    <>
      <p className="text-eyebrow uppercase text-navy">{moduleLabels(v.kind).school} committee</p>
      <CommitteeTabs />
      {children}
    </>
  );
}
