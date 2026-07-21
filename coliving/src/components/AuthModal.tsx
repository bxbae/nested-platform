"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAuth } from "@/lib/api/useAuth";
import { API_BASE_URL } from "@/lib/api/config";

// Kicks off a provider OAuth flow. The backend handles the handshake and
// redirects back to /auth/callback with tokens.
function social(provider: "google" | "kakao" | "naver") {
  window.location.href = `${API_BASE_URL}/auth/${provider}`;
}

const socialBtn: React.CSSProperties = {
  width: "100%",
  justifyContent: "center",
  gap: 8,
  padding: "10px 0",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  fontWeight: 600,
};

// Login / sign-up modal. Uses the existing useAuth() hook, so it works in both
// demo mode (fabricated local session) and real-API mode (NestJS /auth).
// Rendered through a portal to document.body so the sticky header's stacking
// context can't clip it.

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
  // Set when registration returns "verification required" instead of a session:
  // we keep the modal open and show a check-your-email message.
  const [notice, setNotice] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  async function submit() {
    setError("");
    if (mode === "register" && name.trim().length < 2) {
      setError("닉네임은 2자 이상 입력해주세요.");
      return;
    }
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        const res = await register(email, password, name);
        // Real API with a mail provider: no session yet — prompt for email
        // verification and keep the modal open.
        if ("verificationRequired" in res) {
          setNotice(res.message);
          setBusy(false);
          return;
        }
      }
      onClose();
      // reset for next open
      setName("");
      setEmail("");
      setPassword("");
      setNotice("");
    } catch (e) {
      setError((e as Error).message || "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "40px 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          marginTop: "auto",
          marginBottom: "auto",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #ebebeb)",
          borderRadius: 20,
          padding: 28,
          position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
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
              placeholder="닉네임 *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="nickname"
              style={inputStyle}
            />
          )}
          {mode === "register" && (
            <p style={{ margin: "-4px 2px 2px", fontSize: 12, lineHeight: 1.55, color: "var(--text-2)" }}>
              닉네임은 룸메이트 매칭, 프로필, 친구 목록 및 메시지에 공개됩니다.
              개인정보 보호를 위해 실명, 이메일, 전화번호 대신 별명을 사용해주세요.
            </p>
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
            placeholder={mode === "register" ? "비밀번호 (8자 이상)" : "비밀번호"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            style={inputStyle}
          />
        </div>

        {notice && (
          <p style={{ color: "var(--primary)", fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
            {notice}
          </p>
        )}
        {error && (
          <p style={{ color: "#e5484d", fontSize: 13, marginTop: 12 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="btn btn-primary press"
          style={{ width: "100%", justifyContent: "center", marginTop: 18, padding: "11px 0", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
        </button>

        {/* Only on login — offering this during signup makes no sense. */}
        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <a
              href="/auth/forgot"
              style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "underline" }}
            >
              비밀번호를 잊으셨나요?
            </a>
          </div>
        )}

        {/* social logins — redirect to backend OAuth start routes */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>또는</span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn press" onClick={() => social("google")} style={socialBtn}>
            <span style={{ fontWeight: 700, color: "#4285F4" }}>G</span> Google로 계속하기
          </button>
          <button className="btn press" onClick={() => social("kakao")} style={{ ...socialBtn, background: "#FEE500", borderColor: "#FEE500", color: "#191600" }}>
            <span style={{ fontWeight: 700 }}>K</span> 카카오로 계속하기
          </button>
          <button className="btn press" onClick={() => social("naver")} style={{ ...socialBtn, background: "#03C75A", borderColor: "#03C75A", color: "#fff" }}>
            <span style={{ fontWeight: 800 }}>N</span> 네이버로 계속하기
          </button>
        </div>

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
    </div>,
    document.body,
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--border, #ebebeb)",
  background: "var(--bg-2, #f7f7f7)",
  color: "var(--text, #222222)",
  fontSize: 15,
  outline: "none",
};
