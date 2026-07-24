"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  type AdminBanner,
} from "@/lib/api/admin";
import { uploadImage } from "@/lib/api/storage";

const POSITIONS = ["메인 상단", "검색 결과", "앱 홈"];
const DEFAULT_COLOR = "#FF5A5F";

export default function AdminBanners() {
  const [list, setList] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [position, setPosition] = useState(POSITIONS[0]);
  const [linkUrl, setLinkUrl] = useState("");
  const [order, setOrder] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setList(await listBanners());
    } catch {
      setList([]);
      setError("배너 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function resetForm() {
    setTitle("");
    setColor(DEFAULT_COLOR);
    setPosition(POSITIONS[0]);
    setLinkUrl("");
    setOrder(0);
    setImageUrl("");
    setError("");
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    try {
      setImageUrl(await uploadImage(file, "banners"));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "이미지 업로드에 실패했습니다.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    if (!title.trim() || busy || uploading) return;
    if (position === "메인 상단" && !imageUrl.trim()) {
      setError("메인 상단 배너에는 이미지를 등록해주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createBanner({
        title: title.trim(),
        color,
        position,
        linkUrl: linkUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        order,
      });
      resetForm();
      setCreating(false);
      await refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "배너 등록에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggle(banner: AdminBanner) {
    setList((previous) =>
      previous.map((item) =>
        item.id === banner.id ? { ...item, active: !item.active } : item,
      ),
    );
    try {
      await updateBanner(banner.id, { active: !banner.active });
      await refresh();
    } catch {
      setError("배너 상태 변경에 실패했습니다.");
      await refresh();
    }
  }

  async function move(banner: AdminBanner, direction: -1 | 1) {
    try {
      await updateBanner(banner.id, { order: banner.order + direction });
      await refresh();
    } catch {
      setError("배너 순서 변경에 실패했습니다.");
    }
  }

  async function remove(id: string) {
    if (!confirm("이 배너를 삭제할까요?")) return;
    setList((previous) => previous.filter((banner) => banner.id !== id));
    try {
      await deleteBanner(id);
    } catch {
      setError("배너 삭제에 실패했습니다.");
      await refresh();
    }
  }

  const activeCount = list.filter((banner) => banner.active).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>배너 관리</h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>노출 중 배너 {activeCount}개</p>
        </div>
        <button className="btn btn-primary press" onClick={() => { setCreating((current) => !current); resetForm(); }}>
          {creating ? "취소" : "+ 새 배너"}
        </button>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 12, background: "#fff1f1", color: "#c7353a", fontSize: 14 }}>
          {error}
        </div>
      )}

      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 18, display: "grid", gap: 14 }}>
          <div className="field">
            <label htmlFor="banner-title">관리용 제목</label>
            <input id="banner-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 신규 입주자 쿠폰 배너" maxLength={200} />
          </div>

          <div className="field">
            <label htmlFor="banner-image">배너 이미지</label>
            <input id="banner-image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleImageUpload} disabled={uploading} />
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>권장 해상도는 2400 x 1050px이며, 메인 화면에서 16:7 비율로 자동 잘림 처리됩니다. 메인 상단 배너를 2개 이상 노출하면 5초마다 자동 슬라이드됩니다.</span>
          </div>

          {uploading && <span style={{ color: "var(--secondary)", fontSize: 13 }}>이미지 업로드 중…</span>}

          {imageUrl && (
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 7",
                overflow: "hidden",
                borderRadius: 16,
                background: "var(--bg-2)",
              }}
            >
              <img src={imageUrl} alt="등록할 배너 미리보기" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
              <button type="button" className="btn btn-ghost" onClick={() => setImageUrl("")} style={{ position: "absolute", top: 10, right: 10, padding: "7px 12px", background: "rgba(255,255,255,0.94)", color: "#222" }}>
                이미지 제거
              </button>
            </div>
          )}

          <div className="field">
            <label htmlFor="banner-link">클릭 연결 주소</label>
            <input id="banner-link" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="예: https://nested.kr/coupons 또는 비워두기" />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 7, fontSize: 13.5, color: "var(--text-2)" }}>
              위치
              <select value={position} onChange={(event) => setPosition(event.target.value)} style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                {POSITIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>

            <label style={{ display: "grid", gap: 7, fontSize: 13.5, color: "var(--text-2)" }}>
              노출 순서
              <input type="number" value={order} onChange={(event) => setOrder(Number(event.target.value))} style={{ width: 110, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }} />
            </label>

            <label style={{ display: "grid", gap: 7, fontSize: 13.5, color: "var(--text-2)" }}>
              대체 색상
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} style={{ width: 52, height: 42, border: "1px solid var(--border)", borderRadius: 8 }} />
            </label>
          </div>

          <button className="btn btn-primary press" style={{ justifySelf: "start", opacity: busy || uploading ? 0.6 : 1 }} onClick={create} disabled={busy || uploading}>
            {busy ? "등록 중…" : "배너 등록"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}
      {!loading && list.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          등록된 배너가 없습니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {list.map((banner) => (
            <div key={banner.id} className="card" style={{ overflow: "hidden", opacity: banner.active ? 1 : 0.62 }}>
              <div style={{ width: "100%", aspectRatio: "16 / 7", background: banner.imageUrl ? `url("${banner.imageUrl}") center / cover no-repeat` : `linear-gradient(135deg, ${banner.color}, ${banner.color}bb)`, display: "flex", alignItems: "flex-end", padding: 20 }}>
                <strong style={{ color: "#fff", fontSize: 18, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.34)", textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>
                  {banner.title}
                </strong>
              </div>

              <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="chip" style={{ fontSize: 11 }}>{banner.position}</span>
                  <span className="chip" style={{ fontSize: 11 }}>순서 {banner.order}</span>
                  <span className="chip" style={{ fontSize: 11, background: banner.active ? "var(--secondary)" : "var(--border)", color: banner.active ? "#fff" : "var(--text-2)", border: "none" }}>
                    {banner.active ? "노출 중" : "숨김"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => move(banner, -1)}>앞으로</button>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 12px" }} onClick={() => move(banner, 1)}>뒤로</button>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px" }} onClick={() => toggle(banner)}>{banner.active ? "숨기기" : "노출"}</button>
                  <button className="btn btn-ghost press" style={{ fontSize: 12.5, padding: "6px 14px", color: "#e5484d" }} onClick={() => remove(banner.id)}>삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
