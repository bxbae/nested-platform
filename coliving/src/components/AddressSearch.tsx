// 배치 위치: src/components/AddressSearch.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Kakao 우편번호 서비스로 도로명 주소를 검색한다.
//
// 이 서비스를 고른 이유: API 키가 필요 없고, 사용량 제한도 없으며, 상업적
// 이용까지 무료다. 데이터는 행정안전부 도로명주소 DB를 직접 받아 최신이다.
//
// 주의 — 팝업 하단의 'Powered by kakao' 로고는 가리면 안 된다. 무료 제공의
// 근거이며, 숨기면 사용 제약을 받는다. 기본 UI를 그대로 쓰므로 자동 표시된다.
//
// 도메인 참고: 구 도메인(dmaps.daum.net 등)은 2026년 4~5월 종료 예정이라
// 신규 카카오 도메인(t1.kakaocdn.net)으로 처음부터 로드한다.

const SCRIPT_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const SCRIPT_ID = "kakao-postcode-sdk";

// 서비스가 돌려주는 값 중 우리가 쓰는 것만. 전체 스펙은 카카오 가이드 참고.
interface PostcodeResult {
  /** 도로명 주소 (예: 서울 성동구 아차산로 100) */
  roadAddress: string;
  /** 지번 주소 — 도로명이 없는 일부 주소를 위한 대비책 */
  jibunAddress: string;
  /** 참고 항목 (예: 건물명) */
  buildingName?: string;
  zonecode: string;
}

declare global {
  interface Window {
    daum?: { Postcode: new (opts: { oncomplete: (data: PostcodeResult) => void }) => { open: () => void } };
    kakao?: { Postcode?: new (opts: { oncomplete: (data: PostcodeResult) => void }) => { open: () => void } };
  }
}

/** 스크립트를 한 번만 로드하고, 이미 로드 중이면 그 약속을 재사용한다. */
let loading: Promise<void> | null = null;

function loadPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.daum?.Postcode || window.kakao?.Postcode) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("postcode load failed")));
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("postcode load failed"));
    document.head.appendChild(script);
  }).finally(() => {
    loading = null;
  });

  return loading;
}

export function AddressSearch({
  value,
  onChange,
  error,
  placeholder = "주소 검색을 눌러 도로명 주소를 선택하세요",
}: {
  value: string;
  /** 선택한 도로명 주소 + 사용자가 입력한 상세주소를 합쳐 돌려준다. */
  onChange: (address: string) => void;
  error?: string;
  placeholder?: string;
}) {
  // 검색으로 확정된 기본 주소와, 사용자가 직접 치는 상세주소를 나눠 둔다.
  // 합친 값만 상위로 올려 폼은 문자열 하나만 다루면 된다.
  const [base, setBase] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 외부에서 값이 들어온 경우(수정 화면 등) 기본 주소로 취급한다.
  useEffect(() => {
    if (value && !base && !detail) setBase(value);
    // value 는 최초 주입만 반영한다 — 이후에는 이 컴포넌트가 소유한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const push = useCallback(
    (nextBase: string, nextDetail: string) => {
      const merged = [nextBase, nextDetail].filter(Boolean).join(" ").trim();
      onChange(merged);
    },
    [onChange],
  );

  const openSearch = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await loadPostcodeScript();
      const Postcode = window.kakao?.Postcode ?? window.daum?.Postcode;
      if (!Postcode) throw new Error("postcode unavailable");

      new Postcode({
        oncomplete: (data) => {
          if (!mounted.current) return;
          // 도로명이 없는 주소도 있어 지번으로 대체한다.
          let addr = data.roadAddress || data.jibunAddress;
          if (data.buildingName) addr += ` (${data.buildingName})`;
          setBase(addr);
          push(addr, detail);
        },
      }).open();
    } catch {
      // 스크립트를 못 불러오면(오프라인·차단 등) 직접 입력으로 넘어간다.
      setFailed(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, detail, push]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={base}
          readOnly={!failed}
          onChange={(e) => {
            // 검색이 불가능할 때만 직접 입력을 허용한다.
            setBase(e.target.value);
            push(e.target.value, detail);
          }}
          placeholder={placeholder}
          aria-label="도로명 주소"
          style={{ flex: 1, background: failed ? undefined : "var(--bg-2)" }}
        />
        <button
          type="button"
          className="btn btn-ghost press"
          onClick={openSearch}
          disabled={busy}
          style={{ whiteSpace: "nowrap", fontSize: 13.5, padding: "0 14px" }}
        >
          {busy ? "여는 중…" : "주소 검색"}
        </button>
      </div>

      {/* 동·호수는 검색 결과에 없으므로 따로 받는다 */}
      <input
        value={detail}
        onChange={(e) => {
          setDetail(e.target.value);
          push(base, e.target.value);
        }}
        placeholder="상세주소 (동·호수 등)"
        aria-label="상세주소"
      />

      {failed && (
        <p style={{ fontSize: 12, color: "var(--primary)" }}>
          주소 검색을 열지 못했어요. 도로명 주소를 직접 입력해주세요.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: "var(--primary)" }}>{error}</p>}
    </div>
  );
}
