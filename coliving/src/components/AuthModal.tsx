"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/lib/api/useAuth";

// Login / sign-up modal. Uses the existing useAuth() hook, so it works in both
// demo mode (fabricated local session) and real-API mode (NestJS /auth).
// Tab state toggles between "login" and "register".

export function AuthModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit() {
    setError("");
    if (!email || !password || (mode === "register" && !name)) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, name);
      onClose();
      // reset for next open
      setName("");
      setEmail("");
      setPassword("");
    } catch (e) {
      setError((e as Error).message || "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: 28,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-2)",
          }}
        >
          <X size={20} />
        </button>

        <h2
          className="display"
          style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </h2>
        <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 20 }}>
          {mode === "login"
            ? "Nested에 오신 걸 환영합니다."
            : "몇 초면 계정을 만들 수 있어요."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <input
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: "#e5484d", fontSize: 13, marginTop: 12 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="btn btn-primary press"
          style={{ width: "100%", marginTop: 18, padding: "11px 0", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
        </button>

        <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--text-2)", marginTop: 16 }}>
          {mode === "login" ? "계정이 없으신가요? " : "이미 계정이 있으신가요? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--brand, #FF5A5F)",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 15,
  outline: "none",
};
