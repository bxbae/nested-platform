import { Injectable } from "@nestjs/common";

// 실시간 다중 이동수단 조회
// ODsay API 하나로 버스/지하철/지하철+버스(환승)를 실제 경로 기준 실시간 조회.
// 도보/자차는 API 없이 거리 기반 계산으로 처리한다
@Injectable()
export class TransitService {
  async getRoutes(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const km = this.haversine(fromLat, fromLng, toLat, toLng);

    // 도보: API 없이 계산 (기존 commute.ts와 같은 공식)
    const walk = { mode: "walk", minutes: Math.max(4, Math.round(km * 13)), km: this.round1(km) };

    // 자차(택시): 실시간 교통정보 API가 아직 없어 평균 주행속도로 근사
    // (정확한 실시간 반영은 추후 별도 API 검토 — 오늘은 추정치로 표시)
    const car = { mode: "car", minutes: Math.max(3, Math.round((km / 25) * 60)), km: this.round1(km), estimated: true };

    // ODsay 키가 없으면(발급 대기 중) 대중교통 옵션은 조용히 빈 배열로 응답.
    // 프론트는 이 경우 도보/자차만 보여주고, 버스·지하철 탭은 "준비 중"으로 표시.
    if (!process.env.ODSAY_API_KEY) {
      return { walk, car, transit: [] };
    }

    try {
      const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${fromLng}&SY=${fromLat}&EX=${toLng}&EY=${toLat}&apiKey=${process.env.ODSAY_API_KEY}`;
      const res = await fetch(url);
      const data: any = await res.json();

      // ODsay는 여러 경로 후보를 배열로 주는데, 각 후보의 pathType으로
      // 1=지하철, 2=버스, 3=지하철+버스(환승)를 구분해준다.
      const paths = data?.result?.path ?? [];
      const modeLabel = (pathType: number) =>
        pathType === 1 ? "subway" : pathType === 2 ? "bus" : "subway_bus";

      // 같은 유형 중 가장 빠른 경로 하나씩만 골라서 대표로 사용
      const byMode = new Map<string, any>();
      for (const p of paths) {
        const mode = modeLabel(p.pathType);
        const minutes = p.info?.totalTime;
        if (!byMode.has(mode) || minutes < byMode.get(mode).minutes) {
          byMode.set(mode, { mode, minutes, transferCount: p.info?.busTransitCount + p.info?.subwayTransitCount });
        }
      }

      return { walk, car, transit: Array.from(byMode.values()) };
    } catch {
      // API 호출 실패해도 도보/자차는 그대로 보여준다
      return { walk, car, transit: [] };
    }
  }

  private haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  private round1(n: number) {
    return Math.round(n * 10) / 10;
  }
}