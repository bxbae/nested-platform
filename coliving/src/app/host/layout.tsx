import { HostSidebar } from "@/components/HostSidebar";
import { HostGate } from "./HostGate";

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <div className="host-layout">
        <HostSidebar />
        <div style={{ minWidth: 0 }}>
          <HostGate>{children}</HostGate>
        </div>
      </div>
    </div>
  );
}