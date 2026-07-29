import { Controller, Get } from "@nestjs/common";

// 헬스체크 — 외부 크론(UptimeRobot 등)이 주기적으로 찔러
// Render 무료 인스턴스가 잠들지 않게 유지하는 용도.
// DB나 외부 자원을 건드리지 않고 즉시 응답한다.
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
