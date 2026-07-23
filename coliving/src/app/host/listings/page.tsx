"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { Thumbnail } from "@/components/Thumbnail";
import { listMyRooms, updateRoom, deleteRoom, type HostListing } from "@/lib/api/rooms";
import { uploadImage } from "@/lib/api/storage";

// 숙소 관리 — only *my* listings, and unlike search this includes rooms still
// waiting on admin approval. Previously this page showed every room in the DB
// and stamped "게시중" on all of them, so a host couldn't tell what was live.
export default function HostListings() {
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 인라인 편집 — 사진·주소처럼 등록 흐름 전체가 필요한 항목은 제외하고,
  // 자주 손보는 금액·조건만 이 화면에서 바로 고친다.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ monthlyRent: 0, deposit: 0, minStayMonths: 1 });
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setListings(await listMyRooms());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "숙소를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(h: HostListing) {
    setEditingId(h.id);
    setDraft({
      monthlyRent: h.monthlyRent,
      deposit: h.deposit,
      minStayMonths: h.minStayMonths ?? 1,
    });
    // gallery is already in display order (index 0 = 대표 사진).
    setPhotos(h.gallery ?? []);
    setPhotoError(null);
  }

  function addPhoto() {
    const url = photoUrl.trim();
    if (!url) return;
    try {
      new URL(url); // reject anything the API's z.string().url() would refuse
    } catch {
      setPhotoError("올바른 이미지 URL이 아니에요.");
      return;
    }
    setPhotoError(null);
    setPhotos((prev) => [...prev, url].slice(0, 8));
    setPhotoUrl("");
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setPhotoError(null);
    try {
      const room = 8 - photos.length;
      const picked = Array.from(files).slice(0, room);
      const urls = await Promise.all(picked.map((file) => uploadImage(file)));
      setPhotos((prev) => [...prev, ...urls].slice(0, 8));
    } catch (e) {
      setPhotoError(
        e instanceof Error
          ? `${e.message} 이미지 URL 붙여넣기로 추가할 수도 있어요.`
          : "이미지 업로드에 실패했어요.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveEdit(id: string) {
    if (saving) return;
    setSaving(true);
    try {
      await updateRoom(id, {
        monthlyRent: Number(draft.monthlyRent),
        deposit: Number(draft.deposit),
        minStayMonths: Number(draft.minStayMonths),
        images: photos,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "수정하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(h: HostListing) {
    if (busyId) return;
    if (!confirm(`"${h.name.trim()}" 숙소를 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBusyId(h.id);
    try {
      await deleteRoom(h.id);
      await load();
    } catch (e) {
      // 진행 중 예약이 있으면 서버가 막는다 — 그 메시지를 그대로 보여준다.
      setError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>숙소 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>등록한 숙소를 관리하고 수정하세요.</p>
        </div>
        <Link href="/host/listings/new" className="btn btn-primary press">+ 숙소 등록</Link>
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : listings.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          아직 등록한 숙소가 없어요.
          <div style={{ fontSize: 13.5, marginTop: 8 }}>
            우측 상단의 “숙소 등록”으로 첫 매물을 올려보세요.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {listings.map((h) => (
            <div key={h.id} className="card" style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
              <div style={{ width: 180, minWidth: 140, flex: "1 1 140px", maxWidth: 220 }}>
                <Thumbnail src={h.photo} color={h.color} height="100%">
                  <div />
                </Thumbnail>
              </div>
              <div style={{ flex: "3 1 300px", padding: 18, display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16 }}>{h.name.trim()}</strong>
                    <span className="chip" style={{ fontSize: 11 }}>{ROOM_TYPE_LABELS[h.roomType]}</span>
                    {h.published ? (
                      <span
                        className="chip"
                        style={{ fontSize: 11, background: "var(--secondary)", color: "#fff", border: "none" }}
                      >
                        게시중
                      </span>
                    ) : (
                      <span
                        className="chip"
                        style={{ fontSize: 11, background: "var(--warning)", color: "#fff", border: "none" }}
                      >
                        승인 대기
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
                    {h.region} · ★ {h.rating} · 후기 {h.reviews}
                  </div>
                  {editingId === h.id ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 12, maxWidth: 420 }}>
                      <div>
                        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 6 }}>
                          사진 (최대 8장 · 첫 번째가 대표)
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                          <input
                            value={photoUrl}
                            onChange={(e) => setPhotoUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addPhoto();
                              }
                            }}
                            placeholder="이미지 URL 붙여넣기 (https://…)"
                            style={{ flex: 1, fontSize: 13 }}
                          />
                          <button
                            type="button"
                            className="btn btn-ghost press"
                            style={{ fontSize: 12.5, padding: "6px 10px" }}
                            onClick={addPhoto}
                            disabled={photos.length >= 8}
                          >
                            URL추가
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost press"
                            style={{ fontSize: 12.5, padding: "6px 10px" }}
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading || photos.length >= 8}
                          >
                            {uploading ? "업로드 중…" : "＋ 파일"}
                          </button>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            multiple
                            // hidden 대신 화면 밖으로 밀어둔다 — display:none 인풋은
                            // .click()으로 열어도 change 이벤트가 안 오는 브라우저가 있다.
                            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                            tabIndex={-1}
                            onChange={(e) => onFiles(e.target.files)}
                          />
                        </div>
                        {photoError && (
                          <p style={{ fontSize: 12, color: "var(--primary)", marginBottom: 8 }}>{photoError}</p>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                          {photos.map((src, i) => (
                            <div key={i} style={{ position: "relative", height: 64, borderRadius: 8, overflow: "hidden" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt={`사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              {i === 0 && (
                                <span className="chip" style={{ position: "absolute", top: 3, left: 3, fontSize: 9, padding: "1px 5px", background: "#fff" }}>
                                  대표
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                                aria-label="사진 삭제"
                                style={{
                                  position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 99,
                                  background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {photos.length === 0 && (
                            <div style={{ fontSize: 12, color: "var(--text-2)", gridColumn: "1 / -1" }}>
                              사진이 없어요. URL을 붙여넣거나 파일을 올려주세요.
                            </div>
                          )}
                        </div>
                      </div>
                      <label style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                        월세 (원)
                        <input
                          type="number"
                          value={draft.monthlyRent}
                          onChange={(e) => setDraft({ ...draft, monthlyRent: Number(e.target.value) })}
                          style={{ width: "100%", marginTop: 3 }}
                        />
                      </label>
                      <label style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                        보증금 (원)
                        <input
                          type="number"
                          value={draft.deposit}
                          onChange={(e) => setDraft({ ...draft, deposit: Number(e.target.value) })}
                          style={{ width: "100%", marginTop: 3 }}
                        />
                      </label>
                      <label style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                        최소 계약 개월
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={draft.minStayMonths}
                          onChange={(e) => setDraft({ ...draft, minStayMonths: Number(e.target.value) })}
                          style={{ width: "100%", marginTop: 3 }}
                        />
                      </label>
                      <p style={{ fontSize: 12, color: "var(--text-2)" }}>
                        주소·소개글은 등록 화면에서만 수정할 수 있어요.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "var(--text-2)", flexWrap: "wrap" }}>
                      <span>월세 {won(h.monthlyRent)}</span>
                      <span>보증금 {won(h.deposit)}</span>
                      <span>예약 {h.reservationCount}건</span>
                    </div>
                  )}
                  {!h.published && (
                    <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
                      관리자 승인 전까지는 검색 결과에 노출되지 않아요.
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", flexShrink: 0 }}>
                  <Link href={`/homes/${h.id}`} className="btn btn-ghost press" style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}>
                    미리보기
                  </Link>
                  {editingId === h.id ? (
                    <>
                      <button
                        className="btn btn-primary press"
                        style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center", opacity: saving ? 0.6 : 1 }}
                        onClick={() => saveEdit(h.id)}
                        disabled={saving}
                      >
                        {saving ? "저장 중…" : "저장"}
                      </button>
                      <button
                        className="btn btn-ghost press"
                        style={{ fontSize: 13, padding: "8px 14px" }}
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-ghost press"
                        style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}
                        onClick={() => startEdit(h)}
                      >
                        수정
                      </button>
                      <button
                        className="btn btn-ghost press"
                        style={{ fontSize: 13, padding: "8px 14px", color: "#e5484d", justifyContent: "center" }}
                        onClick={() => remove(h)}
                        disabled={busyId === h.id}
                      >
                        {busyId === h.id ? "삭제 중…" : "삭제"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
