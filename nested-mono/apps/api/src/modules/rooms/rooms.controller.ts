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

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rooms.findOne(id);
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
