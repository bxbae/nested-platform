import { API_BASE_URL, USE_REAL_API } from "./config";

export interface LegalRegionOption {
  code: string;
  city: string;
  district: string;
  neighborhood: string;
}

export async function getLegalNeighborhoods(
  district: string,
  city = "서울특별시",
): Promise<LegalRegionOption[]> {
  if (!district) return [];

  if (!USE_REAL_API) {
    return [];
  }

  const params = new URLSearchParams({ city, district });
  const response = await fetch(
    `${API_BASE_URL}/rooms/regions?${params.toString()}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("법정동 목록을 불러오지 못했습니다.");
  }

  const data = (await response.json()) as {
    items?: LegalRegionOption[];
  };

  return data.items ?? [];
}
