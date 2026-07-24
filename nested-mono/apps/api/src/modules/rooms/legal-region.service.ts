import {
  Injectable,
  Logger,
} from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

export interface LegalRegionOption {
  code: string;
  city: string;
  district: string;
  neighborhood: string;
}

type VWorldRecord = Record<string, unknown>;

@Injectable()
export class LegalRegionService {
  private readonly logger = new Logger(LegalRegionService.name);
  private readonly cache = new Map<string, { expiresAt: number; rows: LegalRegionOption[] }>();
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  // "서울특별시" ↔ "서울", "경기도" ↔ "경기" 같은 축약/정식 표기를 함께 반환합니다.
  private cityAliases(city: string): string[] {
    const trimmed = city.trim();
    if (!trimmed) return [];

    const aliases = new Set<string>([trimmed]);
    const suffixes = ["특별자치시", "특별자치도", "특별시", "광역시", "도"];

    for (const suffix of suffixes) {
      if (trimmed.endsWith(suffix) && trimmed.length > suffix.length) {
        aliases.add(trimmed.slice(0, -suffix.length));
      }
    }

    // 짧은 이름으로 들어온 경우 정식 명칭도 후보에 넣습니다.
    const expansions: Record<string, string[]> = {
      서울: ["서울특별시"],
      부산: ["부산광역시"],
      대구: ["대구광역시"],
      인천: ["인천광역시"],
      광주: ["광주광역시"],
      대전: ["대전광역시"],
      울산: ["울산광역시"],
      세종: ["세종특별자치시"],
      경기: ["경기도"],
      강원: ["강원도", "강원특별자치도"],
      제주: ["제주도", "제주특별자치도"],
    };
    for (const value of expansions[trimmed] ?? []) aliases.add(value);

    return [...aliases];
  }

  // VWorld가 응답하지 않을 때 쓰는 폴백. 실제 매물이 등록된 동만 돌려주므로
  // 검색 필터에서 결과가 0건인 동을 고르는 일이 없습니다.
  private async neighborhoodsFromRooms(
    city: string,
    district: string,
  ): Promise<LegalRegionOption[]> {
    // 등록 데이터는 "서울", VWorld/프론트는 "서울특별시"처럼 표기가 다릅니다.
    // 두 표기를 모두 후보로 넣어 어느 쪽으로 저장돼 있든 걸리게 합니다.
    const cityAliases = this.cityAliases(city);

    const rows = await this.prisma.room.findMany({
      where: {
        published: true,
        ...(cityAliases.length ? { city: { in: cityAliases } } : {}),
        ...(district ? { district } : {}),
        neighborhood: { not: null },
      },
      select: {
        city: true,
        district: true,
        neighborhood: true,
        legalDongCode: true,
      },
      distinct: ["neighborhood"],
    });

    return rows
      .filter((row) => row.neighborhood)
      .map((row) => ({
        // 법정동 코드가 없는 과거 데이터는 동 이름을 키로 대신 씁니다.
        code: row.legalDongCode ?? `name:${row.neighborhood}`,
        city: row.city ?? city,
        district: row.district ?? district,
        neighborhood: row.neighborhood as string,
      }))
      .sort((a, b) => a.neighborhood.localeCompare(b.neighborhood, "ko"));
  }

  async getNeighborhoods(
    city = "서울특별시",
    district?: string,
  ): Promise<LegalRegionOption[]> {
    const normalizedCity = city.trim();
    const normalizedDistrict = district?.trim() ?? "";
    const cacheKey = `${normalizedCity}:${normalizedDistrict}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.rows;
    }

    const key = process.env.VWORLD_API_KEY?.trim();
    const domain = process.env.VWORLD_API_DOMAIN?.trim();

    if (!key) {
      this.logger.warn("VWORLD_API_KEY missing — falling back to room data");
      return this.neighborhoodsFromRooms(normalizedCity, normalizedDistrict);
    }

    const query = [normalizedCity, normalizedDistrict].filter(Boolean).join(" ");
    const url = new URL("https://api.vworld.kr/req/data");
    url.searchParams.set("service", "data");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("data", "LT_C_ADEMD_INFO");
    url.searchParams.set("key", key);
    url.searchParams.set("format", "json");
    url.searchParams.set("size", "1000");
    url.searchParams.set("page", "1");
    url.searchParams.set("attrFilter", `full_nm:like:${query}`);
    if (domain) url.searchParams.set("domain", domain);

    let payload: unknown;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      this.logger.warn(`VWorld request failed: ${String(error)}`);
      return this.neighborhoodsFromRooms(normalizedCity, normalizedDistrict);
    }

    // VWorld는 인증 오류도 HTTP 200으로 돌려주므로 본문 status를 직접 봅니다.
    const status = (payload as { response?: { status?: string } })?.response?.status;
    if (status && status !== "OK") {
      const detail = (payload as { response?: { error?: { code?: string } } })
        ?.response?.error?.code;
      this.logger.warn(`VWorld returned ${status} (${detail ?? "unknown"})`);
      return this.neighborhoodsFromRooms(normalizedCity, normalizedDistrict);
    }

    const records = this.extractRecords(payload);
    const rows = records
      .map((record) => this.normalizeRecord(record))
      .filter((row): row is LegalRegionOption => Boolean(row))
      .filter((row) => row.city === normalizedCity)
      .filter((row) => !normalizedDistrict || row.district === normalizedDistrict)
      .filter((row) => row.neighborhood.endsWith("동"))
      .filter(
        (row, index, all) =>
          all.findIndex((item) => item.code === row.code) === index,
      )
      .sort((a, b) =>
        a.neighborhood.localeCompare(b.neighborhood, "ko"),
      );

    // 필터를 모두 통과한 결과가 없으면 등록된 매물 기준으로 대체합니다.
    if (rows.length === 0) {
      return this.neighborhoodsFromRooms(normalizedCity, normalizedDistrict);
    }

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.ttlMs,
      rows,
    });

    return rows;
  }

  private extractRecords(payload: unknown): VWorldRecord[] {
    if (!payload || typeof payload !== "object") return [];

    const root = payload as Record<string, unknown>;
    const response = root.response as Record<string, unknown> | undefined;
    const result = response?.result as Record<string, unknown> | undefined;
    const featureCollection = result?.featureCollection as
      | Record<string, unknown>
      | undefined;

    const candidates = [
      featureCollection?.features,
      result?.features,
      root.features,
    ];

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue;
      return candidate
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const obj = item as Record<string, unknown>;
          const properties =
            obj.properties && typeof obj.properties === "object"
              ? (obj.properties as VWorldRecord)
              : obj;
          return properties;
        })
        .filter((item): item is VWorldRecord => Boolean(item));
    }

    return [];
  }

  private normalizeRecord(record: VWorldRecord): LegalRegionOption | null {
    const fullName = this.pickString(record, [
      "full_nm",
      "fullName",
      "adm_nm",
      "address",
    ]);
    const code = this.pickString(record, [
      "emd_cd",
      "emdCd",
      "bjd_cd",
      "bjdCode",
    ]);

    if (!fullName || !code) return null;

    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;

    return {
      code,
      city: parts[0] ?? "",
      district: parts[1] ?? "",
      neighborhood: parts.slice(2).join(" "),
    };
  }

  private pickString(record: VWorldRecord, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }
}
