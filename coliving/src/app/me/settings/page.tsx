"use client";

import { useState } from "react";
import { currentUser } from "@/lib/me";

export default function Settings() {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [bio, setBio] = useState(currentUser.bio);
  const [saved, setSaved] = useState(false);

  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>설정</h1>

      {/* profile edit */}
      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <strong style={{ fontSize: 16, display: "block", marginBottom: 16 }}>프로필 정보</strong>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="이름"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="이메일"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></Field>
          <Field label="휴대폰"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="자기소개">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              style={{ width: "100%", padding: 11, border: "1px solid var(--border)", borderRadius: "var(--r-sm)", resize: "vertical" }} />
          </Field>
        </div>
      </section>

      {/* notification prefs */}
      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <strong style={{ fontSize: 16, display: "block", marginBottom: 8 }}>알림 설정</strong>
        <ToggleRow label="푸시 알림" value={notifPush} onChange={setNotifPush} />
        <ToggleRow label="이메일 알림" value={notifEmail} onChange={setNotifEmail} />
        <ToggleRow label="마케팅 정보 수신" value={notifMarketing} onChange={setNotifMarketing} />
      </section>

      {/* account */}
      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <strong style={{ fontSize: 16, display: "block", marginBottom: 12 }}>계정</strong>
        <button className="btn btn-ghost press" style={{ width: "100%", justifyContent: "flex-start", marginBottom: 8 }}>
          비밀번호 변경
        </button>
        <button className="btn btn-ghost press" style={{ width: "100%", justifyContent: "flex-start", color: "var(--primary)" }}>
          회원 탈퇴
        </button>
      </section>

      <button
        className="btn btn-primary press"
        style={{ width: "100%", justifyContent: "center" }}
        onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
      >
        {saved ? "저장되었습니다 ✓" : "변경사항 저장"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 0", fontSize: 15 }}
    >
      <span>{label}</span>
      <span style={{ width: 44, height: 26, borderRadius: 99, background: value ? "var(--secondary)" : "var(--border)", position: "relative", transition: "background .15s ease", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left .18s var(--ease-out)", boxShadow: "var(--shadow-sm)" }} />
      </span>
    </button>
  );
}
