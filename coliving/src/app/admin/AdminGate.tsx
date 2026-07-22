"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";

// Guards the whole /admin section. Unlike MeGate (which redirects a
// logged-out visitor elsewhere), a non-admin just sees a plain "관리자만
// 접근할 수 있는 페이지입니다." message in place of the page — no redirect.
//
// The brief "확인 중" state avoids a false flash of that message: the SSR
// snapshot of useAuth() is always null (auth lives in localStorage, which
// isn't available on the server), so without this an admin refreshing the
// page would see "관리자만 접근할 수 있는 페이지입니다." for one frame
// before hydration catches up.
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-2)" }}>
        확인하는 중…
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          color: "var(--text-2)",
          fontSize: 15,
        }}
      >
        관리자만 접근할 수 있는 페이지입니다.
      </div>
    );
  }

  return <>{children}</>;
}
