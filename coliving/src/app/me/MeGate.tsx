"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { USE_REAL_API } from "@/lib/api/config";

// Guards the whole /me section. In real-API mode, a logged-out visitor is
// bounced to the home page (where they can open the auth modal) instead of
// seeing demo profile data. Demo mode keeps the sample data so the pages are
// still browsable without an account.
export function MeGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    if (!USE_REAL_API) {
      setChecked(true);
      return;
    }
    if (!user) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace("/?auth=1");
      }
    } else if (
      user.nicknameCompleted === false &&
      !pathname.startsWith("/me/settings")
    ) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace("/me/settings?nickname=required");
      }
    } else {
      setChecked(true);
    }
    // pathname is a dependency: after the redirect above lands on
    // /me/settings this effect must re-run and fall through to
    // setChecked(true). Without it the gate stayed on the loading state
    // forever for social logins (nicknameCompleted === false).
  }, [user, router, pathname]);

  if (!checked) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-2)" }}>
        로그인 정보를 확인하는 중…
      </div>
    );
  }

  return <>{children}</>;
}
