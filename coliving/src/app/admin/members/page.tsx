"use client";

// 회원 관리 — reference implementation for the admin section.
//
// This is the pattern every 🟡 admin page should follow:
//   1. Load real data in an effect, tracking loading/error state.
//   2. Debounce the search box so we don't hit the API on every keystroke.
//   3. Update the row optimistically after a mutation, then reconcile.
// Copy this shape for /admin/reports and the dashboard.

import { useCallback, useEffect, useState } from "react";
import {
  listMembers,
  suspendMember,
  verifyMember,
  setMemberRole,
  type AdminMember,
  type MemberRole,
} from "@/lib/api/admin";
import { useAuth } from "@/lib/api/useAuth";

const ROLE_LABEL: Record<string, string> = {
  GUEST: "게스트",
  HOST: "호스트",
  ADMIN: "관리자",
};

export default function AdminMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // id of the row whose suspend toggle is in flight — disables just that button.
  const [busyId, setBusyId] = useState<string | null>(null);
  // id awaiting a second click before we actually suspend.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // id of the row whose role dropdown is in flight.
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listMembers(search));
    } catch (e) {
      setError(e instanceof Error ? e.message : "회원 목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce: wait 300ms after the last keystroke before searching.
  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  // Flip the identity-verified badge. Optimistic: the row updates immediately
  // and reverts by refetching if the request fails.
  async function toggleVerify(m: AdminMember) {
    setMembers((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, verified: !m.verified } : x)),
    );
    try {
      await verifyMember(m.id, !m.verified);
    } catch {
      // Re-fetch with the current query so the row reflects server state again.
      load(q);
    }
  }

  async function toggle(m: AdminMember) {
    if (busyId) return;
    // Suspending is disruptive, so require a second click to confirm — but
    // un-suspending is safe, so do it immediately.
    if (!m.suspended && confirmId !== m.id) {
      setConfirmId(m.id);
      return;
    }
    setBusyId(m.id);
    setError(null);
    try {
      await suspendMember(m.id, !m.suspended);
      setMembers((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, suspended: !m.suspended } : x)),
      );
      setConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 변경하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  // Change a member's role — most notably, granting ADMIN. Confirm before
  // granting or revoking admin rights specifically, since that's the
  // sensitive case; GUEST ↔ HOST is low-stakes and goes through immediately.
  // Optimistic like the other toggles, with a refetch-on-failure fallback.
  async function changeRole(m: AdminMember, role: MemberRole) {
    if (roleBusyId || role === m.role) return;
    const isAdminChange = role === "ADMIN" || m.role === "ADMIN";
    if (
      isAdminChange &&
      !confirm(
        role === "ADMIN"
          ? `${m.name}님에게 관리자 권한을 부여할까요? 이 회원은 다음 로그인부터 관리자로 전환돼요.`
          : `${m.name}님의 관리자 권한을 해제할까요?`,
      )
    ) {
      return;
    }
    setRoleBusyId(m.id);
    setError(null);
    const prevRole = m.role;
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
    try {
      await setMemberRole(m.id, role);
    } catch (e) {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: prevRole } : x)));
      setError(e instanceof Error ? e.message : "역할을 변경하지 못했어요.");
    } finally {
      setRoleBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>회원 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        {loading ? "불러오는 중…" : `${members.length}명`}
      </p>

      <div style={{ marginBottom: 18 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 또는 이메일 검색"
          style={{
            width: "100%", maxWidth: 360, padding: "10px 14px",
            border: "1px solid var(--border)", borderRadius: "var(--r-pill)",
            background: "var(--surface)", color: "var(--text)",
          }}
        />
      </div>

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="admin-table-head" style={{ gridTemplateColumns: "1.5fr auto auto auto auto auto 1fr" }}>
          <span>회원</span><span>역할</span><span>가입일</span><span>상태</span><span>평균 별점</span><span>신고</span><span></span>
        </div>

        {!loading && members.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-2)", fontSize: 14 }}>
            {q ? "검색 결과가 없어요." : "회원이 없어요."}
          </div>
        )}

        {members.map((m) => {
          const isSelf = m.id === user?.id;
          return (
            <div key={m.id} className="admin-table-row" style={{ gridTemplateColumns: "1.5fr auto auto auto auto auto 1fr" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  {m.name}{isSelf && <span style={{ color: "var(--text-2)", fontWeight: 400 }}> (나)</span>}
                  {m.verified && (
                    <span
                      title="신원 확인됨"
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                        background: "var(--secondary)", color: "#fff",
                      }}
                    >
                      ✓ 인증
                    </span>
                  )}
                  <span
                    title={`완료 숙박 ${m.completedStays}건 · 리뷰 ${m.reviewsWritten}건`}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999,
                      border: "1px solid var(--border)", color: "var(--text-2)",
                    }}
                  >
                    {m.tierLabel}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                  {m.email}
                </span>
              </span>

              <span>
                {isSelf ? (
                  <span className="chip" style={{ fontSize: 11 }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                ) : (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value as MemberRole)}
                    disabled={roleBusyId === m.id}
                    title="역할 변경 — 관리자 권한 부여/해제도 여기서 처리해요."
                    style={{
                      fontSize: 11.5, fontWeight: 600, padding: "4px 8px",
                      borderRadius: 999, cursor: "pointer",
                      border: m.role === "ADMIN" ? "1px solid var(--primary)" : "1px solid var(--border)",
                      color: m.role === "ADMIN" ? "var(--primary)" : "var(--text)",
                      background: "var(--surface)",
                      opacity: roleBusyId === m.id ? 0.5 : 1,
                    }}
                  >
                    <option value="GUEST">게스트</option>
                    <option value="HOST">호스트</option>
                    <option value="ADMIN">관리자</option>
                  </select>
                )}
              </span>

              <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                {new Date(m.createdAt).toLocaleDateString("ko-KR")}
              </span>

              <span>
                <span
                  className="chip"
                  style={{
                    fontSize: 11, border: "none", color: "#fff",
                    background: m.suspended ? "var(--primary)" : "var(--secondary)",
                  }}
                >
                  {m.suspended ? "정지" : "정상"}
                </span>
              </span>

              <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                {m.avgRating !== null ? `★ ${m.avgRating}` : "—"}
              </span>

              <span
                style={{
                  fontSize: 13,
                  color: m.reportCount > 0 ? "var(--primary)" : "var(--text-2)",
                  fontWeight: m.reportCount > 0 ? 700 : 400,
                }}
              >
                {m.reportCount > 0 ? `${m.reportCount}건` : "—"}
              </span>

              <span style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => toggleVerify(m)}
                  title={m.verified ? "인증 해제" : "신원 확인 처리"}
                >
                  {m.verified ? "인증 해제" : "인증"}
                </button>
                {/* Can't suspend yourself — the API blocks it, so hide the button. */}
                {isSelf ? (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>—</span>
                ) : (
                  <button
                    className="btn btn-ghost press"
                    style={{
                      fontSize: 12, padding: "6px 12px",
                      color: confirmId === m.id ? "#fff" : undefined,
                      background: confirmId === m.id ? "var(--primary)" : undefined,
                      borderColor: confirmId === m.id ? "var(--primary)" : undefined,
                    }}
                    onClick={() => toggle(m)}
                    disabled={busyId === m.id}
                    onBlur={() => confirmId === m.id && setConfirmId(null)}
                  >
                    {busyId === m.id
                      ? "처리 중…"
                      : m.suspended
                        ? "해제"
                        : confirmId === m.id
                          ? "정지할까요?"
                          : "정지"}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
