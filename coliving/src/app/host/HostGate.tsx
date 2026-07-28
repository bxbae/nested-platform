"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import { authStore } from "@/lib/api/auth-store";
import { becomeHost } from "@/lib/api/auth";
import { USE_REAL_API } from "@/lib/api/config";

export function HostGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [checked, setChecked] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest = user != null && user.role !== "HOST" && user.role !== "ADMIN";

  useEffect(() => {
    if (!USE_REAL_API) return;

    const real = authStore.getUser();
    setChecked(true);

    if (!real && !redirected.current) {
      redirected.current = true;
      router.replace("/?auth=1");
    }
  }, [user, router]);

  async function upgrade() {
    setUpgrading(true);
    setError(null);
    try {
      await becomeHost();
    } catch (e) {
      setError(e instanceof Error ? e.message : "호스트 전환에 실패했어요.");
    } finally {
      setUpgrading(false);
    }
  }

  if (!USE_REAL_API) return <>{children}</>;

  if (!checked || !user) {
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
