"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  listBanners,
  createBanner,
  reorderBanners,
  updateBanner,
  deleteBanner,
  type AdminBanner,
} from "@/lib/api/admin";
import { uploadImage } from "@/lib/api/storage";

const BANNER_POSITION = "메인 상단";
const DEFAULT_BANNER_IMAGE = "/hero-friends.png";
const MAX_TOTAL_BANNERS = 5;
const DEFAULT_BANNER_COUNT = 1;
const MAX_REGISTERED_BANNERS = MAX_TOTAL_BANNERS - DEFAULT_BANNER_COUNT;
const DEFAULT_COLOR = "#FF5A5F";

function isSupportedLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function sortBanners(rows: AdminBanner[]): AdminBanner[] {
  return rows
    .filter((banner) => banner.position === BANNER_POSITION)
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

export default function AdminBanners() {
  const [list, setList] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setList(sortBanners(await listBanners()));
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
    setLinkUrl("");
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
    if (list.length >= MAX_REGISTERED_BANNERS) {
      setError("기본 배너를 포함해 메인 배너는 최대 5장까지 노출할 수 있습니다.");
      return;
    }

    if (!title.trim() || busy || uploading) return;
    if (!imageUrl.trim()) {
      setError("메인 상단 배너 이미지를 등록해주세요.");
      return;
    }
    if (!isSupportedLink(linkUrl)) {
      setError("연결 주소는 /로 시작하는 내부 경로 또는 http(s) 주소로 입력해주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await createBanner({
        title: title.trim(),
        color,
        position: BANNER_POSITION,
        linkUrl: linkUrl.trim() || null,
        imageUrl: imageUrl.trim(),
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
    if (movingId) return;

    const currentIndex = list.findIndex((item) => item.id === banner.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= list.length) return;

    const next = [...list];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    setList(next);
    setMovingId(banner.id);
    setError("");

    try {
      const rows = await reorderBanners(next.map((item) => item.id));
      setList(sortBanners(rows));
    } catch {
      setError("배너 순서 변경에 실패했습니다.");
      await refresh();
    } finally {
      setMovingId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("이 배너를 삭제할까요?")) return;
    setList((previous) => previous.filter((banner) => banner.id !== id));
    try {
      await deleteBanner(id);
      await refresh();
    } catch {
      setError("배너 삭제에 실패했습니다.");
      await refresh();
    }
  }

  const activeCount = list.filter((banner) => banner.active).length;
  const totalCount = DEFAULT_BANNER_COUNT + list.length;
  const overLimit = list.length > MAX_REGISTERED_BANNERS;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 className="display" style={{ fontSize: 30 }}>
            배너 관리
          </h1>
          <p style={{ color: "var(--text-2)", marginTop: 4 }}>
            전체 슬라이드 {totalCount}/{MAX_TOTAL_BANNERS}장 · 기본 배너 1장 + 등록 배너 {list.length}/{MAX_REGISTERED_BANNERS}장 · 노출 중 {activeCount + 1}장
          </p>
        </div>
        <button
          className="btn btn-primary press"
          disabled={!creating && list.length >= MAX_REGISTERED_BANNERS}
          onClick={() => {
            setCreating((current) => !current);
            resetForm();
          }}
        >
          {creating
            ? "취소"
            : list.length >= MAX_REGISTERED_BANNERS
              ? "최대 5장 등록됨"
              : "+ 새 배너"}
        </button>
      </div>

      {overLimit && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff8e8",
            color: "#9a6500",
            fontSize: 14,
          }}
        >
          기존 등록 배너가 4장을 초과합니다. 데이터는 삭제하지 않으며, 메인 화면에는 앞의 4장까지만 노출됩니다. 불필요한 배너를 직접 숨기거나 삭제해주세요.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            background: "#fff1f1",
            color: "#c7353a",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {creating && (
        <div
          className="card"
          style={{ padding: 20, marginBottom: 18, display: "grid", gap: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--bg-2)",
            }}
          >
            <strong>노출 위치</strong>
            <span style={{ color: "var(--text-2)" }}>메인 상단 고정</span>
          </div>

          <div className="field">
            <label htmlFor="banner-title">관리용 제목</label>
            <input
              id="banner-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 신규 입주자 쿠폰 배너"
              maxLength={200}
            />
          </div>

          <div className="field">
            <label htmlFor="banner-image">배너 이미지</label>
            <input
              id="banner-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleImageUpload}
              disabled={uploading}
            />
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>
              권장 해상도는 2400 × 1050px입니다. 기본 메인 이미지 1장과 등록 배너 최대 4장을 합쳐 총 5장이 5초마다 순서대로 노출됩니다.
            </span>
          </div>

          {uploading && (
            <span style={{ color: "var(--secondary)", fontSize: 13 }}>
              이미지 업로드 중…
            </span>
          )}

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
              <div
                role="img"
                aria-label="등록할 배너 미리보기"
                style={{
                  width: "100%",
                  height: "100%",
                  background: `url("${imageUrl}") center / cover no-repeat`,
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setImageUrl("")}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  padding: "7px 12px",
                  background: "rgba(255,255,255,0.94)",
                  color: "#222",
                }}
              >
                이미지 제거
              </button>
            </div>
          )}

          <div className="field">
            <label htmlFor="banner-link">버튼 연결 주소 (선택)</label>
            <input
              id="banner-link"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="예: /me/coupons 또는 https://nested.kr/coupons"
            />
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>
              주소를 입력하면 해당 배너에 연결 버튼이 표시됩니다. 쿠폰 주소에는 “쿠폰 확인하러 가기”가 표시됩니다.
            </span>
          </div>

          <label
            style={{
              display: "grid",
              gap: 7,
              width: "fit-content",
              fontSize: 13.5,
              color: "var(--text-2)",
            }}
          >
            대체 색상
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              style={{
                width: 52,
                height: 42,
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
          </label>

          <button
            className="btn btn-primary press"
            style={{ justifySelf: "start", opacity: busy || uploading ? 0.6 : 1 }}
            onClick={create}
            disabled={busy || uploading}
          >
            {busy ? "등록 중…" : "배너 등록"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            role="img"
            aria-label="기본 메인 배너 이미지"
            style={{
              width: "100%",
              aspectRatio: "16 / 7",
              background: `url("${DEFAULT_BANNER_IMAGE}") center / cover no-repeat`,
              display: "flex",
              alignItems: "flex-end",
              padding: 20,
            }}
          >
            <strong
              style={{
                color: "#fff",
                fontSize: 18,
                padding: "6px 10px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.34)",
                textShadow: "0 1px 4px rgba(0,0,0,0.25)",
              }}
            >
              기본 메인 이미지
            </strong>
          </div>
          <div
            style={{
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="chip" style={{ fontSize: 11 }}>슬라이드 1</span>
              <span className="chip" style={{ fontSize: 11 }}>기본 배너</span>
              <span
                className="chip"
                style={{
                  fontSize: 11,
                  background: "var(--secondary)",
                  color: "#fff",
                  border: "none",
                }}
              >
                항상 노출
              </span>
            </div>
            <span style={{ color: "var(--text-2)", fontSize: 13 }}>
              등록 배너보다 먼저 표시되며 순서 변경·숨김·삭제 대상이 아닙니다.
            </span>
          </div>
        </div>
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}
      {!loading && list.length === 0 && (
        <div
          className="card"
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-2)",
            border: "1px dashed var(--border)",
            background: "transparent",
          }}
        >
          추가 등록된 배너가 없습니다. 현재는 기본 메인 이미지만 노출됩니다.
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          {list.map((banner, index) => {
            const moving = movingId !== null;
            return (
              <div
                key={banner.id}
                className="card"
                style={{ overflow: "hidden", opacity: banner.active ? 1 : 0.62 }}
              >
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 7",
                    background: banner.imageUrl
                      ? `url("${banner.imageUrl}") center / cover no-repeat`
                      : `linear-gradient(135deg, ${banner.color}, ${banner.color}bb)`,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 20,
                  }}
                >
                  <strong
                    style={{
                      color: "#fff",
                      fontSize: 18,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "rgba(0,0,0,0.34)",
                      textShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    }}
                  >
                    {banner.title}
                  </strong>
                </div>

                <div
                  style={{
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="chip" style={{ fontSize: 11 }}>
                      슬라이드 {index + 2}
                    </span>
                    {banner.linkUrl && (
                      <span className="chip" style={{ fontSize: 11 }}>버튼 연결됨</span>
                    )}
                    <span
                      className="chip"
                      style={{
                        fontSize: 11,
                        background: banner.active
                          ? "var(--secondary)"
                          : "var(--border)",
                        color: banner.active ? "#fff" : "var(--text-2)",
                        border: "none",
                      }}
                    >
                      {banner.active ? "노출 중" : "숨김"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-ghost press"
                      style={{ fontSize: 12.5, padding: "6px 12px" }}
                      onClick={() => move(banner, -1)}
                      disabled={moving || index === 0}
                    >
                      앞으로
                    </button>
                    <button
                      className="btn btn-ghost press"
                      style={{ fontSize: 12.5, padding: "6px 12px" }}
                      onClick={() => move(banner, 1)}
                      disabled={moving || index === list.length - 1}
                    >
                      뒤로
                    </button>
                    <button
                      className="btn btn-ghost press"
                      style={{ fontSize: 12.5, padding: "6px 14px" }}
                      onClick={() => toggle(banner)}
                      disabled={moving}
                    >
                      {banner.active ? "숨기기" : "노출"}
                    </button>
                    <button
                      className="btn btn-ghost press"
                      style={{ fontSize: 12.5, padding: "6px 14px", color: "#e5484d" }}
                      onClick={() => remove(banner.id)}
                      disabled={moving}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
