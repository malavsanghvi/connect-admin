import { CommitteeTabs } from "./committee-tabs";

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className="text-eyebrow uppercase text-purple">Pathshala committee</p>
      <CommitteeTabs />
      {children}
    </>
  );
}
