import { MeSidebar } from "@/components/MeSidebar";
import { MeGate } from "./MeGate";

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <div className="host-layout">
        <MeSidebar />
        <div style={{ minWidth: 0 }}>
          <MeGate>{children}</MeGate>
        </div>
      </div>
    </div>
  );
}
