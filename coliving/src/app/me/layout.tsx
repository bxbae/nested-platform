import { MeSidebar } from "@/components/MeSidebar";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <div className="host-layout">
        <MeSidebar />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
