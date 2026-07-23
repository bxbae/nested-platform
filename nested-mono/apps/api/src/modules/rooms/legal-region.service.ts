import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

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
      throw new InternalServerErrorException({
        code: "VWORLD_KEY_MISSING",
        message: "VWORLD_API_KEY가 설정되지 않았습니다.",
      });
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
      throw new BadGatewayException({
        code: "VWORLD_REQUEST_FAILED",
        message: "법정동 정보를 불러오지 못했습니다.",
      });
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
