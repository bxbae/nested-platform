"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SCRIPT_SRC =
  "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
const SCRIPT_ID = "kakao-postcode-sdk";

export interface AddressValue {
  city: string;
  district: string;
  neighborhood: string;
  legalDongCode: string;
  roadAddress: string;
  jibunAddress: string;
  detailAddress: string;
  zipCode: string;
}

interface PostcodeResult {
  roadAddress: string;
  jibunAddress: string;
  buildingName?: string;
  zonecode: string;
  sido: string;
  sigungu: string;
  bname: string;
  bcode: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: PostcodeResult) => void;
      }) => { open: () => void };
    };
    kakao?: {
      Postcode?: new (opts: {
        oncomplete: (data: PostcodeResult) => void;
      }) => { open: () => void };
    };
  }
}

let loading: Promise<void> | null = null;

function loadPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.daum?.Postcode || window.kakao?.Postcode) {
    return Promise.resolve();
  }
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("postcode load failed")),
      );
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

const EMPTY_ADDRESS: AddressValue = {
  city: "",
  district: "",
  neighborhood: "",
  legalDongCode: "",
  roadAddress: "",
  jibunAddress: "",
  detailAddress: "",
  zipCode: "",
};

export function AddressSearch({
  value = EMPTY_ADDRESS,
  onChange,
  error,
}: {
  value?: AddressValue;
  onChange: (value: AddressValue) => void;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback(
    (next: Partial<AddressValue>) => {
      onChange({ ...value, ...next });
    },
    [onChange, value],
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

          patch({
            city: data.sido ?? "",
            district: data.sigungu ?? "",
            neighborhood: data.bname ?? "",
            legalDongCode: data.bcode ?? "",
            roadAddress: data.roadAddress || data.jibunAddress,
            jibunAddress: data.jibunAddress ?? "",
            zipCode: data.zonecode ?? "",
          });
        },
      }).open();
    } catch {
      setFailed(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, patch]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value.roadAddress}
          readOnly
          placeholder="주소 검색을 눌러 도로명 주소를 선택하세요"
          aria-label="도로명 주소"
          style={{ flex: 1, background: "var(--bg-2)" }}
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

      <input
        value={value.detailAddress}
        onChange={(event) => patch({ detailAddress: event.target.value })}
        placeholder="상세주소 (동·호수 등)"
        aria-label="상세주소"
        disabled={!value.roadAddress}
      />

      {value.neighborhood && (
        <p style={{ fontSize: 12, color: "var(--text-2)" }}>
          확인된 지역: {value.city} {value.district} {value.neighborhood}
        </p>
      )}

      {failed && (
        <p style={{ fontSize: 12, color: "var(--primary)" }}>
          주소 검색을 열지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {error && (
        <p style={{ fontSize: 12, color: "var(--primary)" }}>{error}</p>
      )}
    </div>
  );
}
