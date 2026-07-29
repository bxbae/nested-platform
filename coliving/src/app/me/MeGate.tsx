"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { authStore } from "@/lib/api/auth-store";
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
    // useAuth()의 user는 useSyncExternalStore의 "서버 스냅샷"(항상 null)을
    // 첫 클라이언트 렌더링(hydration) 때 그대로 쓴다 — 실제로 로그인
    // 상태여도 이 순간엔 무조건 null처럼 보일 수 있다. 이 effect가 그
    // 타이밍에 걸리면 로그인된 사용자를 로그아웃 상태로 오판해서
    // 잘못 리디렉션한다. authStore.getUser()는 그 스냅샷 지연 없이
    // 지금 진짜 로그인 상태를 바로 알려줘서 이 문제를 피할 수 있다.
    const currentUser = authStore.getUser();
    if (!currentUser) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace("/?auth=1");
      }
    } else if (
      currentUser.nicknameCompleted === false &&
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
    //
    // user도 여전히 의존성에 둔다 — authStore가 나중에(로그인/로그아웃
    // 등으로) 바뀌면 useSyncExternalStore가 재렌더링을 트리거하는데,
    // 그 재렌더링에 맞춰 이 effect도 다시 돌아서 최신 상태를 반영해야
    // 한다.
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
