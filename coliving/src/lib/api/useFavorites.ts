// 배치 위치: src/lib/api/useFavorites.ts
"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { USE_REAL_API } from "./config";
import { addFavorite, removeFavorite, listFavoriteIds } from "./favorites";

// 찜 상태를 한 곳에 모아 두는 아주 작은 스토어.
//
// 검색 결과에는 카드가 수십 개 뜬다. 카드마다 listFavoriteIds() 를 부르면
// 같은 요청이 화면당 수십 번 나가므로, 목록은 최초 1회만 받아 모듈 스코프에
// 보관하고 모든 카드가 그것을 구독한다. 상세 화면에서 찜을 눌러도 이 스토어를
// 통하면 검색 화면과 상태가 어긋나지 않는다.

let ids: Set<string> = new Set();
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

// useSyncExternalStore 는 getSnapshot 이 매번 같은 참조를 돌려주길 기대한다.
// Set 을 그대로 넘기면 매 렌더 새 객체가 되어 무한 루프가 나므로, 변경이
// 있을 때만 바뀌는 버전 숫자를 스냅샷으로 쓴다.
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => version;
const getServerSnapshot = () => 0;

async function ensureLoaded() {
  if (!USE_REAL_API || loaded || inflight) return inflight ?? undefined;
  inflight = listFavoriteIds()
    .then((list) => {
      ids = new Set(list);
      loaded = true;
      emit();
    })
    .catch(() => {
      // 비로그인 등으로 실패하면 빈 상태로 둔다 — 버튼은 눌러 볼 수 있고,
      // 그때 401 이 나면 로그인 안내가 뜬다.
      loaded = true;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * 찜 상태와 토글 함수를 돌려준다.
 * @param roomId 이 카드가 가리키는 숙소
 */
export function useFavorite(roomId: string) {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    ensureLoaded();
  }, []);

  const saved = ids.has(roomId);

  const toggle = useCallback(async (): Promise<
    { ok: true; saved: boolean } | { ok: false; reason: "auth" | "error" }
  > => {
    const next = !ids.has(roomId);

    // 낙관적 반영 — 네트워크를 기다리지 않고 하트가 즉시 채워진다.
    if (next) ids.add(roomId);
    else ids.delete(roomId);
    emit();

    if (!USE_REAL_API) return { ok: true, saved: next };

    try {
      if (next) await addFavorite(roomId);
      else await removeFavorite(roomId);
      return { ok: true, saved: next };
    } catch (e) {
      // 실패하면 되돌린다.
      if (next) ids.delete(roomId);
      else ids.add(roomId);
      emit();
      const msg = (e as Error)?.message ?? "";
      const isAuth = msg.includes("401") || msg.includes("인증") || msg.includes("로그인");
      return { ok: false, reason: isAuth ? "auth" : "error" };
    }
  }, [roomId]);

  return { saved, toggle };
}

/** 다른 화면에서 찜이 바뀐 뒤 목록을 다시 받아야 할 때. */
export function invalidateFavorites() {
  loaded = false;
  ids = new Set();
  emit();
  ensureLoaded();
}
