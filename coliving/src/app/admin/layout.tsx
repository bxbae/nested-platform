import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminGate } from "./AdminGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ paddingTop: 28, paddingBottom: 60 }}>
      <AdminGate>
        <div className="host-layout">
          <AdminSidebar />
          <div style={{ minWidth: 0 }}>{children}</div>
        </div>
      </AdminGate>
    </div>
  );
}
