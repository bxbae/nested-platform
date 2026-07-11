"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStore } from "@/lib/api/auth-store";
import { fetchMe } from "@/lib/api/auth";

// Landing route for social logins. The backend redirects here as
// /auth/callback#accessToken=…&refreshToken=… after Google/Kakao/Naver OAuth.
// We read the tokens from the URL fragment (not sent to servers), persist the
// session, hydrate the user, then head into the app.
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        if (!accessToken || !refreshToken) {
          setError(true);
          return;
        }
        // Seed a minimal session, then fill in the real user via /auth/me.
        authStore.set({
          accessToken,
          refreshToken,
          user: { id: "", email: "", role: "GUEST" },
        });
        await fetchMe();
        router.replace("/me");
      } catch {
        setError(true);
      }
    })();
  }, [router]);

  return (
    <div style={{ padding: "120px 0", textAlign: "center", color: "var(--text-2)" }}>
      {error ? (
        <>
          <p style={{ marginBottom: 16 }}>로그인 처리에 실패했어요.</p>
          <button className="btn btn-primary press" onClick={() => router.replace("/?auth=1")}>
            다시 로그인
          </button>
        </>
      ) : (
        "로그인 중…"
      )}
    </div>
  );
}
