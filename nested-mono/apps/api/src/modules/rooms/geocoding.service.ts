import { Injectable, BadRequestException, Logger } from "@nestjs/common";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Turns a street address into coordinates.
//
// Done server-side on purpose: the client could otherwise post any lat/lng it
// liked and pin a listing wherever it wanted. Uses Nominatim (OpenStreetMap) —
// free and keyless, but rate-limited and it requires a real User-Agent.
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  async geocode(address: string): Promise<{ lat: number; lng: number; resolved: string }> {
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
      encodeURIComponent(address);

    let rows: NominatimResult[];
    try {
      const res = await fetch(url, {
        headers: {
          // Nominatim rejects requests without an identifying UA.
          "User-Agent": "Nested/1.0 (coliving platform)",
          "Accept-Language": "ko,en",
        },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      rows = (await res.json()) as NominatimResult[];
    } catch (e) {
      this.logger.warn(`Geocoding failed for "${address}": ${e}`);
      throw new BadRequestException({
        code: "GEOCODING_FAILED",
        message: "주소를 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      });
    }

    // Index access can be undefined under noUncheckedIndexedAccess, so narrow
    // it explicitly rather than relying on a length check.
    const hit = rows[0];
    if (!hit) {
      throw new BadRequestException({
        code: "ADDRESS_NOT_FOUND",
        message: "주소를 찾을 수 없어요. 도로명 주소를 정확히 입력해주세요.",
      });
    }

    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      resolved: hit.display_name,
    };
  }
}
