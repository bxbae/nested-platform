// ── Rooms service ───────────────────────────────────────────────────
// One call site for room search + detail. When USE_REAL_API is true it hits
// the NestJS /rooms endpoints and adapts the response; otherwise it falls
// back to the in-repo demo Route Handlers so the app runs with no backend.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import {
  filtersToApiQuery,
  apiSearchToPaginated,
  apiRoomToHouse,
  type ApiRoom,
  type ApiSearchResponse,
} from "./adapters";
import type { RoomType } from "@/lib/types";
import { filtersToParams } from "@/features/search/schema";
import type { SearchParams, PaginatedRooms, House } from "@/lib/types";

export async function searchRooms(
  filters: SearchParams,
  cursor?: string | null
): Promise<PaginatedRooms> {
  if (USE_REAL_API) {
    const params = filtersToApiQuery(filters);
    if (cursor) params.set("cursor", cursor);
    const res = await api.get<ApiSearchResponse>(`/rooms?${params.toString()}`, {
      auth: false, // room reads are public
    });
    return apiSearchToPaginated(res);
  }

  // demo path — existing Next Route Handler
  const params = filtersToParams(filters);
  if (cursor) params.set("cursor", cursor);
  const r = await fetch(`/api/search?${params.toString()}`);
  if (!r.ok) throw new Error("search failed");
  return r.json();
}

// Rooms live at fixed neighborhoods; the API requires lat/lng but asking a host
// to type coordinates is absurd. Map the region they pick to a known point.
// (A real build would geocode the address instead.)
export const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Seongsu-dong": { lat: 37.5446, lng: 127.0559 },
  "Yeonnam-dong": { lat: 37.5636, lng: 126.9256 },
  "Mangwon-dong": { lat: 37.5556, lng: 126.9018 },
  "Seogyo-dong": { lat: 37.5561, lng: 126.9236 },
  "Pangyo": { lat: 37.3948, lng: 127.1112 },
  "Yeoksam-dong": { lat: 37.5006, lng: 127.0366 },
  "Hyehwa-dong": { lat: 37.5822, lng: 127.0018 },
  "Sinchon": { lat: 37.5551, lng: 126.9368 },
};

export interface CreateRoomInput {
  name: string;
  region: string;
  address: string; // real street address — server geocodes it
  verifiedByHost: true; // attestation; the API refuses anything else
  roomType: RoomType;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  minStayMonths: number;
  availableFrom: string; // ISO date
  images: string[];
  /** 함께 지낼 최대 인원. 독채(whole_house)는 null 로 보낸다. */
  capacity?: number | null;
  /** 침실 개수 (선택) */
  bedrooms?: number | null;
}

// POST /rooms — host only. The listing is created unpublished and only becomes
// searchable once an admin approves it.
export async function createRoom(input: CreateRoomInput): Promise<{ id: string }> {
  return api.post<{ id: string }>("/rooms", {
    name: input.name,
    region: input.region,
    address: input.address,
    verifiedByHost: input.verifiedByHost,
    roomType: input.roomType.toUpperCase(),
    monthlyRent: input.monthlyRent,
    deposit: input.deposit,
    cleaningFee: input.cleaningFee,
    maintenanceFee: input.maintenanceFee,
    minStayMonths: input.minStayMonths,
    capacity: input.capacity ?? null,
    bedrooms: input.bedrooms ?? null,
    availableFrom: input.availableFrom,
    images: input.images,
  });
}

// GET /rooms/mine — my listings, including ones still awaiting approval.
// Search only ever returns published rooms, so this is the only way a host can
// see a listing they just submitted.
export interface HostListing extends House {
  published: boolean;
  reservationCount: number;
}

export async function listMyRooms(): Promise<HostListing[]> {
  const rows = await api.get<(ApiRoom & { published: boolean; _count?: { reservations: number } })[]>(
    "/rooms/mine",
  );
  return rows.map((r) => ({
    ...apiRoomToHouse(r),
    published: r.published,
    reservationCount: r._count?.reservations ?? 0,
  }));
}

// PATCH /rooms/:id — 호스트 본인 매물만. 서버가 소유권을 확인한다.
// 사진·주소처럼 등록 흐름 전체가 필요한 항목은 제외하고, 자주 손보는 값만
// 부분 수정으로 받는다.
export interface UpdateRoomInput {
  monthlyRent?: number;
  deposit?: number;
  cleaningFee?: number;
  maintenanceFee?: number;
  minStayMonths?: number;
  availableFrom?: string; // ISO date
  capacity?: number | null;
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<void> {
  await api.patch(`/rooms/${id}`, input);
}

// DELETE /rooms/:id — 예약이 걸려 있으면 서버가 거부한다.
export async function deleteRoom(id: string): Promise<void> {
  await api.delete(`/rooms/${id}`);
}

export async function getRoom(id: string): Promise<House> {
  if (USE_REAL_API) {
    const r = await api.get<ApiRoom>(`/rooms/${id}`, { auth: false });
    return apiRoomToHouse(r);
  }
  // demo path — house detail is served from the local seed via /api/houses
  const r = await fetch(`/api/houses?id=${id}`);
  if (!r.ok) throw new Error("room not found");
  return r.json();
}

// GET /rooms/:id/similar — 비슷한 숙소 추천 (유사 숙소 추천)
// 같은 지역·방종류·가격대·편의시설이 겹치는 숙소를 최대 4개까지 점수 순으로
// 반환한다 (실제 점수 계산은 백엔드 rooms.service.ts의 findSimilar()에서 처리).
// 데모 모드(USE_REAL_API=false)에서는 비교할 실제 데이터가 없으므로 빈 배열 반환.
// 수정 — apiRoomToHouse()가 reasons를 버리기 때문에, 변환 후 다시 붙여준다.
export async function getSimilarRooms(id: string): Promise<(House & { reasons: string[] })[]> {
  if (!USE_REAL_API) return [];
  const rows = await api.get<(ApiRoom & { reasons: string[] })[]>(`/rooms/${id}/similar`, { auth: false });
  return rows.map((r) => ({ ...apiRoomToHouse(r), reasons: r.reasons ?? [] }));
}
