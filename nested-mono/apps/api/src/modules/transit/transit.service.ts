import { Injectable } from "@nestjs/common";

// 다중 이동수단 예상 소요시간 계산
// ⚠️ 2026-07-22 팀 결정: ODsay API 연동 포기.
// 이유: ODsay는 서버(백엔드) 호출 시 고정 IP 등록이 필요한데, 우리 배포
// 환경(Vercel Hobby 플랜)은 서버리스 구조라 요청마다 IP가 바뀌어 고정 IP를
// 쓸 수 없다. Vercel의 고정 IP 기능은 Pro/Enterprise 전용 유료 부가기능
// (월 $100+)이라 학생 프로젝트 규모에 맞지 않아 포기.
//
// 대신 도보/자차와 동일한 방식(거리 기반 공식 계산)으로 버스/지하철/
// 지하철+버스도 예상치를 계산한다. 실시간 API 없이도 사용자 경험은
// 유지하되, "예상치"임을 명확히 표시한다.
@Injectable()
export class TransitService {
  async getRoutes(fromLat: number, fromLng: number, toLat: number, toLng: number) {
    const km = this.haversine(fromLat, fromLng, toLat, toLng);

    // 도보: 기존 그대로 (분당 이동 거리 기반)
    const walk = { mode: "walk", minutes: Math.max(4, Math.round(km * 13)), km: this.round1(km) };

    // 자차(택시): 기존 그대로 (평균 주행속도 25km/h 근사)
    const car = { mode: "car", minutes: Math.max(3, Math.round((km / 25) * 60)), km: this.round1(km), estimated: true };

    // 지하철: 평균 속도 22km/h + 환승/대기 기본 10분
    const subwayMinutes = Math.round(10 + (km / 22) * 60);
    // 버스: 평균 속도 18km/h (신호·정차 많음) + 배차 대기 기본 8분
    const busMinutes = Math.round(8 + (km / 18) * 60);
    // 지하철+버스 환승: 평균 속도 20km/h + 환승 포함 기본 15분
    const subwayBusMinutes = Math.round(15 + (km / 20) * 60);

    const transit = [
      { mode: "subway", minutes: subwayMinutes, transferCount: km < 3 ? 0 : 1 },
      { mode: "bus", minutes: busMinutes, transferCount: km < 8 ? 1 : 2 },
      { mode: "subway_bus", minutes: subwayBusMinutes, transferCount: 1 },
    ];

    return { walk, car, transit };
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