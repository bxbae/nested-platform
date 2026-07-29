"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { becomeHost } from "@/lib/api/auth";
import { USE_REAL_API } from "@/lib/api/config";

// /host 섹션 전체를 지킨다. 기존에는 listings/new 안에만 "호스트로 전환해야
// 등록할 수 있어요" 안내가 있어서, 게스트가 대시보드·캘린더 등 다른 호스트
// 페이지는 그냥 볼 수 있었다. 이 게이트를 레이아웃에 씌우면 /host 아래 어떤
// 경로로 들어오든(주소창에 직접 입력해도) 역할 확인을 먼저 거치게 된다.
//
// - 로그아웃 상태: MeGate와 동일하게 로그인 모달이 뜨는 홈으로 보낸다.
// - 로그인했지만 GUEST: 기존 listings/new의 안내 카드와 같은 디자인으로 전환을
//   유도한다.
// - HOST/ADMIN: children을 그대로 보여준다.
export function HostGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = user != null && user.role !== "HOST" && user.role !== "ADMIN";

  useEffect(() => {
    if (!USE_REAL_API) return; // 데모 모드는 기존과 동일하게 열어둔다.
    // 클라이언트가 localStorage 세션 확인을 마치기 전(첫 하이드레이션
    // 렌더)에는 user가 로그인 상태여도 null이다. ready를 기다리지 않으면
    // 로그인된 사용자도 순간적으로 로그아웃으로 오판해 튕겨나간다.
    if (!ready) return;
    if (!user && !redirected.current) {
      redirected.current = true;
      router.replace("/?auth=1");
    }
  }, [user, ready, router]);

  async function upgrade() {
    setUpgrading(true);
    setError(null);
    try {
      // becomeHost()가 authStore를 갱신한다. useAuth()가 그 스토어를 구독하고
      // 있으므로 role이 HOST로 바뀌는 순간 이 컴포넌트가 다시 렌더링되고,
      // 아래 isGuest가 false가 되면서 children이 자연스럽게 나타난다.
      await becomeHost();
    } catch (e) {
      setError(e instanceof Error ? e.message : "호스트 전환에 실패했어요.");
    } finally {
      setUpgrading(false);
    }
  }

  if (!USE_REAL_API) return <>{children}</>;

  if (!user) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-2)" }}>
        로그인 정보를 확인하는 중…
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
        <strong style={{ fontSize: 18 }}>호스트로 전환해야 이용할 수 있어요</strong>
        <p style={{ color: "var(--text-2)", marginTop: 8, lineHeight: 1.6 }}>
          호스트 페이지는 호스트로 전환한 계정만 이용할 수 있어요. 전환은 한 번이면
          끝나고 바로 시작할 수 있어요.
        </p>
        {error && (
          <p style={{ color: "var(--primary)", marginTop: 8, fontSize: 13 }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
          <button
            className="btn btn-primary press"
            onClick={upgrade}
            disabled={upgrading}
            style={{ opacity: upgrading ? 0.6 : 1 }}
          >
            {upgrading ? "전환 중…" : "호스트로 전환하고 시작하기"}
          </button>
          <button className="btn btn-ghost press" onClick={() => router.push("/")}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}