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
const updateRoomSchema = createRoomSchema.partial();

// 숙소 CRUD + 검색 API (REST). Reads are public; writes require HOST role.
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  search(@Query() q: any) {
    return this.rooms.search({
      region: q.region,
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
  create(@Req() req: any, @Body(new ZodValidationPipe(createRoomSchema)) dto: any) {
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
