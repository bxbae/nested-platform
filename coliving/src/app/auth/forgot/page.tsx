"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api/auth";

// 비밀번호 찾기 — request a reset link.
//
// The success screen is shown for ANY valid email, registered or not. The API
// gives us no way to tell the difference (by design), and revealing it would
// let anyone probe which addresses have accounts.
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: "0 20px" }}>
      {sent ? (
        <>
          <h1 className="display" style={{ fontSize: 28, marginBottom: 12 }}>
            메일을 보냈어요
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-2)", marginBottom: 8 }}>
            <strong style={{ color: "var(--text)" }}>{email}</strong> 로 비밀번호 재설정 링크를
            보냈습니다. 메일함을 확인해주세요.
          </p>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 28 }}>
            링크는 1시간 후 만료됩니다. 메일이 오지 않았다면 스팸함을 확인하거나, 해당 주소로
            가입한 계정이 있는지 확인해주세요.
          </p>
          <Link href="/" className="btn btn-primary press" style={{ justifyContent: "center", width: "100%" }}>
            홈으로
          </Link>
        </>
      ) : (
        <>
          <h1 className="display" style={{ fontSize: 28, marginBottom: 10 }}>
            비밀번호 찾기
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 24 }}>
            가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드려요.
          </p>

          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
              이메일
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="you@example.com"
              autoFocus
              style={{
                width: "100%", padding: "12px 14px", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--text)",
              }}
            />
          </label>

          {error && (
            <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>
          )}

          <button
            className="btn btn-primary press"
            style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}
            onClick={submit}
            disabled={busy || !email.trim()}
          >
            {busy ? "보내는 중…" : "재설정 링크 받기"}
          </button>

          <p style={{ fontSize: 13, color: "var(--text-2)", textAlign: "center" }}>
            소셜 로그인으로 가입하셨다면 해당 서비스로 로그인해주세요.
          </p>
        </>
      )}
    </div>
  );
}
