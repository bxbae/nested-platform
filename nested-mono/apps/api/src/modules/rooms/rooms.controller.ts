import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from "@nestjs/common";
import { z } from "zod";
import { RoomsService } from "./rooms.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards/auth.guards";

const createRoomSchema = z.object({
  name: z.string().min(2),
  region: z.string().min(1),
  // The host types a real street address; the server geocodes it. Coordinates
  // are never taken from the client — otherwise a listing could be pinned
  // anywhere regardless of its actual address.
  address: z.string().min(5, "도로명 주소를 입력해주세요."),
  // Explicit attestation. Refused unless true.
  verifiedByHost: z.literal(true, {
    errorMap: () => ({ message: "실제 매물임을 확인해주세요." }),
  }),
  roomType: z.enum(["ONE_ROOM", "SHARE_ROOM", "WHOLE_HOUSE", "APARTMENT"]),
  // 함께 지낼 최대 인원. 독채는 통째로 빌리므로 정원 개념이 없다 —
  // 아래 superRefine 에서 타입별로 필수/금지를 가른다.
  capacity: z.number().int().min(1).max(20).nullable().optional(),
  // 침실 개수 — 선택 항목. 원룸이면 1, 미입력이면 null.
  bedrooms: z.number().int().min(1).max(10).nullable().optional(),
  monthlyRent: z.number().int().positive(),
  deposit: z.number().int().nonnegative(),
  cleaningFee: z.number().int().nonnegative(),
  maintenanceFee: z.number().int().nonnegative(),
  minStayMonths: z.number().int().min(1).default(3),
  availableFrom: z.string(),
  // Gallery image URLs, in display order. Without this the photos never reach
  // the service — Zod strips unknown keys.
  images: z.array(z.string().url()).max(8).optional().default([]),
});
// 독채가 아니면 정원을 반드시 받고, 독채면 정원을 받지 않는다.
// 프론트 폼에서도 같은 규칙으로 입력칸을 숨기지만, 서버가 최종 판단한다.
const capacityRule = (
  data: { roomType?: string; capacity?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (data.roomType === undefined) return; // 부분 수정: 타입을 안 바꾸면 검사 생략
  if (data.roomType === "WHOLE_HOUSE") {
    if (data.capacity != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capacity"],
        message: "독채는 인원수를 설정하지 않습니다.",
      });
    }
    return;
  }
  if (data.capacity == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacity"],
      message: "함께 지낼 인원수를 입력해주세요.",
    });
  }
};

const createRoomSchemaChecked = createRoomSchema.superRefine(capacityRule);
const updateRoomSchema = createRoomSchema.partial().superRefine(capacityRule);

// 숙소 CRUD + 검색 API (REST). Reads are public; writes require HOST role.
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  search(@Query() q: any) {
    return this.rooms.search({
      region: q.region,
      district: q.district,
      verifiedByHost: q.verifiedByHost === "true" ? true : undefined,
      q: q.q,
      roomType: q.roomType,
      roomTypes: q.roomTypes ? String(q.roomTypes).split(",").filter(Boolean) : undefined,
      minRent: q.minRent ? Number(q.minRent) : undefined,
      maxRent: q.maxRent ? Number(q.maxRent) : undefined,
      availableFrom: q.availableFrom || undefined,
      gender: q.gender || undefined,
      petsAllowed: q.petsAllowed === "true" ? true : undefined,
      smokingAllowed: q.smokingAllowed === "true" ? true : undefined,
      parking: q.parking === "true" ? true : undefined,
      sort: q.sort || undefined,
      cursor: q.cursor,
      minCapacity: q.minCapacity ? Number(q.minCapacity) : undefined,
      minBedrooms: q.minBedrooms ? Number(q.minBedrooms) : undefined,
      checkIn: q.checkIn || undefined,
      checkOut: q.checkOut || undefined,
      take: q.take ? Number(q.take) : undefined,
    });
  }

  // Declared before GET /:id so "mine" isn't captured as a room id.
  // Unlike search, this includes unpublished rooms — a host must be able to see
  // a listing they just submitted while it's still awaiting approval.
  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  mine(@Req() req: any) {
    return this.rooms.listForHost(req.user.id);
  }

  @Get('personalized')
  @UseGuards(JwtAuthGuard)
  getPersonalized(@Req() req: any) {
    return this.rooms.getPersonalizedRooms(req.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rooms.findOne(id);
  }

  // 비슷한 숙소 추천 (유사 숙소 추천)
  // GET /rooms/:id/similar
  // 라우트 순서 주의: 반드시 @Get(":id") 아래, @Post() 위에 있어야 함.
  // NestJS는 라우트를 선언한 순서대로 매칭을 시도하는데, ":id/similar"는
  // ":id" 라우트보다 경로 세그먼트가 하나 더 있어서 순서와 무관하게 정상
  // 동작은 하지만, 관련된 라우트끼리 묶어두면 나중에 보기 편함.
  @Get(":id/similar")
  findSimilar(@Param("id") id: string){
    return this.rooms.findSimilar(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  create(@Req() req: any, @Body(new ZodValidationPipe(createRoomSchemaChecked)) dto: any) {
    return this.rooms.create(req.user.id, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  update(@Req() req: any, @Param("id") id: string, @Body(new ZodValidationPipe(updateRoomSchema)) dto: any) {
    return this.rooms.update(req.user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.rooms.remove(req.user.id, id);
  }


}
