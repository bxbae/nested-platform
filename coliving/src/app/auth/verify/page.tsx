"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmail, resendVerification } from "@/lib/api/auth";

// Landing route for the emailed verification link:
//   /auth/verify?token=…
// We POST the token to the backend, which stamps emailVerified and returns a
// session. On success the user is logged in and sent to /me. On failure (expired
// or reused link) we offer to resend.
function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        await verifyEmail(token);
        setState("done");
        setTimeout(() => router.replace("/me"), 1200);
      } catch {
        setState("error");
      }
    })();
  }, [params, router]);

  async function resend() {
    if (!resendEmail.trim()) return;
    try {
      await resendVerification(resendEmail.trim());
      setResent(true);
    } catch {
      setResent(true); // always show success (no account enumeration)
    }
  }

  return (
    <div style={{ padding: "120px 0", textAlign: "center", color: "var(--text-2)", maxWidth: 420, margin: "0 auto" }}>
      {state === "working" && "이메일 인증 중…"}

      {state === "done" && (
        <>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            인증 완료!
          </p>
          <p>잠시 후 자동으로 이동해요…</p>
        </>
      )}

      {state === "error" && (
        <>
          <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            인증 링크가 만료되었어요
          </p>
          <p style={{ marginBottom: 24 }}>
            링크가 만료되었거나 이미 사용되었어요. 인증 메일을 다시 받아보세요.
          </p>
          {resent ? (
            <p style={{ color: "var(--primary)", fontSize: 14 }}>
              인증 메일을 다시 보냈어요. 메일함을 확인해주세요.
            </p>
          ) : (
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="가입한 이메일"
                style={{
                  padding: "10px 12px", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--text)", fontSize: 14, minWidth: 200,
                }}
              />
              <button
                onClick={resend}
                style={{
                  padding: "10px 20px", borderRadius: "var(--r-sm)", border: "none",
                  background: "var(--primary)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                재발송
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// useSearchParams must sit under a Suspense boundary (Next.js CSR bailout rule).
export default function VerifyEmail() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "120px 0", textAlign: "center", color: "var(--text-2)" }}>
          불러오는 중…
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
