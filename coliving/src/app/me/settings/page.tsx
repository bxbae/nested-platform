"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/api/useAuth";
import {
  updateProfile,
  updatePreferredLocale,
  changePassword,
  deleteAccount,
} from "@/lib/api/auth";
import { useLanguage, type Locale } from "@/contexts/LanguageContext";

// 설정 — profile edit + password change, wired to the API.
//
// Only fields that actually exist server-side are editable. Phone number and
// notification preferences have no DB columns, so rendering inputs for them
// would be a lie: the user would "save" and nothing would happen. They're left
// out until the schema supports them.
export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const { locale, setLocale } = useLanguage();
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageSaved, setLanguageSaved] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("OTHER");
  // <input type="date">가 쓰는 YYYY-MM-DD 형식. 빈 문자열이면 미입력.
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) setName(user.name);
    setBio(user?.bio ?? "");
    if (user?.gender) setGender(user.gender);
    setBirthDate(user?.birthDate ? user.birthDate.slice(0, 10) : "");
  }, [user]);

  async function save() {
    if (saving) return;
    const nickname = name.trim();
    if (nickname.length < 2) {
      setError("닉네임은 2자 이상 입력해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        name: nickname,
        bio: bio.trim(),
        gender,
        birthDate: birthDate ? birthDate : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function changeLanguage(nextLocale: Locale) {
    if (languageSaving || nextLocale === locale) return;

    const previousLocale = locale;

    setLocale(nextLocale);
    setLanguageSaving(true);
    setLanguageSaved(false);
    setLanguageError(null);

    try {
      await updatePreferredLocale(nextLocale === "ko" ? "KO" : "EN");

      setLanguageSaved(true);
      window.setTimeout(() => {
        setLanguageSaved(false);
      }, 2500);
    } catch (e) {
      setLocale(previousLocale);
      setLanguageError(
        e instanceof Error ? e.message : "언어 설정을 저장하지 못했어요.",
      );
    } finally {
      setLanguageSaving(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 620 }}>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
          설정
        </h1>
        <p style={{ color: "var(--text-2)" }}>로그인이 필요해요.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
        설정
      </h1>

      {/* profile */}
      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <strong style={{ fontSize: 16, display: "block", marginBottom: 16 }}>
          프로필 정보
        </strong>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="닉네임 *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={20}
              placeholder="예: 조용한고양이"
              autoComplete="nickname"
            />
            <p
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--text-2)",
                marginTop: 5,
              }}
            >
              닉네임은 룸메이트 매칭, 프로필, 친구 목록 및 메시지에서 다른
              사용자에게 공개됩니다. 개인정보 보호를 위해 실명, 이메일,
              전화번호가 포함되지 않은 별명을 사용해주세요.
            </p>
          </Field>

          {/* Email is read-only: changing it needs a verification flow we don't
              have, and the API rejects it outright. */}
          <Field label="이메일">
            <input
              value={user?.email ?? ""}
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }}
            />
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              이메일은 변경할 수 없어요.
            </p>
          </Field>

          <Field label="자기소개">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="어떤 사람인지 간단히 소개해주세요."
              style={{
                width: "100%",
                padding: 11,
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                resize: "vertical",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            />
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              {bio.length}/500
            </p>
          </Field>

          <Field label="성별">
            <div style={{ display: "flex", gap: 8 }}>
              {(
                [
                  ["MALE", "남성"],
                  ["FEMALE", "여성"],
                  ["OTHER", "기타"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGender(val)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: "var(--r-sm)",
                    border:
                      gender === val
                        ? "1.5px solid var(--primary)"
                        : "1px solid var(--border)",
                    background:
                      gender === val
                        ? "rgba(255,90,95,0.08)"
                        : "var(--surface)",
                    color: gender === val ? "var(--primary)" : "var(--text)",
                    fontWeight: gender === val ? 600 : 400,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="생년월일">
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              다른 사람에게는 20대·30대처럼 연령대만 보여요. 생일에는 쿠폰을 받을 수 있어요.
            </p>
          </Field>
        </div>
      </section>
      {/* language */}
      <section className="card" style={{ padding: 22, marginBottom: 18 }}>
        <strong
          style={{
            fontSize: 16,
            display: "block",
            marginBottom: 8,
          }}
        >
          {locale === "ko" ? "언어 설정" : "Language"}
        </strong>

        <p
          style={{
            marginBottom: 14,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--text-2)",
          }}
        >
          {locale === "ko"
            ? "선택한 언어는 이 계정에 저장되며 다시 로그인해도 유지됩니다."
            : "Your language preference is saved to your account and restored when you sign in again."}
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              ["ko", "한국어"],
              ["en", "English"],
            ] as const
          ).map(([value, label]) => {
            const active = locale === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => void changeLanguage(value)}
                disabled={languageSaving}
                aria-pressed={active}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "var(--r-sm)",
                  border: active
                    ? "1.5px solid var(--primary)"
                    : "1px solid var(--border)",
                  background: active
                    ? "rgba(255,90,95,0.08)"
                    : "var(--surface)",
                  color: active ? "var(--primary)" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  cursor: languageSaving ? "wait" : "pointer",
                  opacity: languageSaving ? 0.7 : 1,
                  fontSize: 14,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {languageSaving && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--text-2)",
            }}
          >
            {locale === "ko" ? "저장 중..." : "Saving..."}
          </p>
        )}

        {languageSaved && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--primary)",
            }}
          >
            {locale === "ko"
              ? "언어 설정이 저장되었습니다."
              : "Language preference saved."}
          </p>
        )}

        {languageError && (
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--primary)",
            }}
          >
            {languageError}
          </p>
        )}
      </section>
      {/* account */}
      <PasswordSection hasPassword={user?.hasPassword !== false} />

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 10 }}>
          {error}
        </p>
      )}

      <button
        className="btn btn-primary press"
        style={{ width: "100%", justifyContent: "center" }}
        onClick={save}
        disabled={saving || name.trim().length < 2}
      >
        {saving ? "저장 중…" : saved ? "저장되었습니다 ✓" : "변경사항 저장"}
      </button>

      <DangerZone />
    </div>
  );
}

// ── Account deletion ──
// Two-step confirm plus a typed phrase: deletion is irreversible, so a single
// stray click must not trigger it.
function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONFIRM = "탈퇴";

  async function remove() {
    if (busy || confirmText !== CONFIRM) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      // Account is gone and local auth is cleared — send them home.
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "탈퇴 처리에 실패했어요.");
      setBusy(false);
    }
  }

  return (
    <section
      className="card"
      style={{ padding: 22, marginTop: 28, border: "1px solid var(--primary)" }}
    >
      <strong
        style={{
          fontSize: 16,
          display: "block",
          marginBottom: 8,
          color: "var(--primary)",
        }}
      >
        회원 탈퇴
      </strong>
      <p
        style={{
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--text-2)",
          marginBottom: 16,
        }}
      >
        탈퇴하면 계정 정보가 삭제되고 다시 로그인할 수 없습니다. 작성하신 리뷰와
        예약 기록은 익명으로 남을 수 있습니다. 이 작업은 되돌릴 수 없어요.
      </p>

      {!open ? (
        <button
          className="btn btn-ghost press"
          style={{ color: "var(--primary)", borderColor: "var(--primary)" }}
          onClick={() => setOpen(true)}
        >
          회원 탈퇴
        </button>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "block" }}>
            <div
              style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}
            >
              계속하려면{" "}
              <strong style={{ color: "var(--text)" }}>{CONFIRM}</strong> 를
              입력하세요.
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                background: "var(--surface)",
                color: "var(--text)",
              }}
            />
          </label>

          {error && (
            <p style={{ fontSize: 13, color: "var(--primary)" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn press"
              style={{
                flex: 1,
                justifyContent: "center",
                background: "var(--primary)",
                color: "#fff",
                opacity: confirmText === CONFIRM && !busy ? 1 : 0.5,
              }}
              onClick={remove}
              disabled={busy || confirmText !== CONFIRM}
            >
              {busy ? "처리 중…" : "영구 탈퇴"}
            </button>
            <button
              className="btn btn-ghost press"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={busy}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Password change ──
// Social-login accounts have no password, so we don't pretend they can change one.
function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (next.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (next !== confirm) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 2500);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "비밀번호를 변경하지 못했어요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ padding: 22, marginBottom: 18 }}>
      <strong style={{ fontSize: 16, display: "block", marginBottom: 12 }}>
        계정
      </strong>

      {!hasPassword ? (
        <p style={{ fontSize: 13.5, color: "var(--text-2)" }}>
          소셜 로그인으로 가입한 계정이에요. 비밀번호가 없어 변경할 수 없습니다.
        </p>
      ) : !open ? (
        <button
          className="btn btn-ghost press"
          style={{ width: "100%", justifyContent: "flex-start" }}
          onClick={() => setOpen(true)}
        >
          비밀번호 변경
        </button>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="현재 비밀번호">
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="새 비밀번호">
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              8자 이상
            </p>
          </Field>
          <Field label="새 비밀번호 확인">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {error && (
            <p style={{ fontSize: 13, color: "var(--primary)" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary press"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={submit}
              disabled={busy || !current || !next || !confirm}
            >
              {busy ? "변경 중…" : done ? "변경되었습니다 ✓" : "비밀번호 변경"}
            </button>
            <button
              className="btn btn-ghost press"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={busy}
            >
              취소
            </button>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-2)" }}>
            변경하면 다른 기기의 로그인이 모두 해제됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-2)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}
