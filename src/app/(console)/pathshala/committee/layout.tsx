import { CommitteeTabs } from "./committee-tabs";

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-purple">Pathshala committee</p>
      <CommitteeTabs />
      {children}
    </>
  );
}
