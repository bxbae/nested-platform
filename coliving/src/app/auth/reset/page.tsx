"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api/auth";

// 비밀번호 재설정 — consumes the token from the emailed link (/auth/reset?token=…).
//
// useSearchParams() suspends, so the form lives in a child under <Suspense>.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell><p style={{ color: "var(--text-2)" }}>불러오는 중…</p></Shell>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A missing token means the link was mangled, not that the user did anything
  // wrong — send them back to request a fresh one rather than showing a form
  // that cannot possibly succeed.
  if (!token) {
    return (
      <Shell>
        <h1 className="display" style={{ fontSize: 26, marginBottom: 12 }}>
          잘못된 링크예요
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 24 }}>
          재설정 링크가 올바르지 않습니다. 메일의 링크를 다시 확인하시거나 새로 요청해주세요.
        </p>
        <Link
          href="/auth/forgot"
          className="btn btn-primary press"
          style={{ justifyContent: "center", width: "100%" }}
        >
          다시 요청하기
        </Link>
      </Shell>
    );
  }

  async function submit() {
    if (busy) return;
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/"), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "재설정에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <h1 className="display" style={{ fontSize: 26, marginBottom: 12 }}>
          변경되었습니다 ✓
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)" }}>
          새 비밀번호로 로그인해주세요. 잠시 후 홈으로 이동합니다.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="display" style={{ fontSize: 26, marginBottom: 10 }}>
        새 비밀번호 설정
      </h1>
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text-2)", marginBottom: 22 }}>
        사용할 새 비밀번호를 입력해주세요.
      </p>

      <label style={{ display: "block", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
          새 비밀번호
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>8자 이상</p>
      </label>

      <label style={{ display: "block", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>
          새 비밀번호 확인
        </div>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={inputStyle}
        />
      </label>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>
      )}

      <button
        className="btn btn-primary press"
        style={{ width: "100%", justifyContent: "center", marginBottom: 12 }}
        onClick={submit}
        disabled={busy || !password || !confirm}
      >
        {busy ? "변경 중…" : "비밀번호 변경"}
      </button>

      <p style={{ fontSize: 12.5, color: "var(--text-2)", textAlign: "center" }}>
        변경하면 다른 기기의 로그인이 모두 해제됩니다.
      </p>
    </Shell>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface)",
  color: "var(--text)",
};

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 420, margin: "60px auto", padding: "0 20px" }}>{children}</div>;
}
