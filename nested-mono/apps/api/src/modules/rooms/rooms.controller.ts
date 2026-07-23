import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { RoomsService } from "./rooms.service";
import { LegalRegionService } from "./legal-region.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
} from "../auth/guards/auth.guards";

const addressSchema = z.object({
  city: z.string().min(1),
  district: z.string().min(1),
  neighborhood: z.string().min(1),
  legalDongCode: z.string().optional().default(""),
  roadAddress: z.string().min(5),
  jibunAddress: z.string().optional().default(""),
  detailAddress: z.string().max(120).optional().default(""),
  zipCode: z.string().max(12).optional().default(""),
});

const createRoomSchema = z
  .object({
    name: z.string().min(2),
    region: z.string().optional(),
    ...addressSchema.shape,
    verifiedByHost: z.literal(true, {
      errorMap: () => ({ message: "실제 매물임을 확인해주세요." }),
    }),
    roomType: z.enum([
      "ONE_ROOM",
      "SHARE_ROOM",
      "WHOLE_HOUSE",
      "APARTMENT",
    ]),
    capacity: z.number().int().min(1).max(20).nullable().optional(),
    bedrooms: z.number().int().min(1).max(10).nullable().optional(),
    monthlyRent: z.number().int().positive(),
    deposit: z.number().int().nonnegative(),
    cleaningFee: z.number().int().nonnegative(),
    maintenanceFee: z.number().int().nonnegative(),
    minStayMonths: z.number().int().min(1).default(3),
    availableFrom: z.string(),
    images: z.array(z.string().url()).max(8).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.roomType === "WHOLE_HOUSE") {
      if (data.capacity != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["capacity"],
          message: "독채는 인원수를 설정하지 않습니다.",
        });
      }
    } else if (data.capacity == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capacity"],
        message: "함께 지낼 인원수를 입력해주세요.",
      });
    }
  });

const updateRoomSchema = z.object({
  monthlyRent: z.number().int().positive().optional(),
  deposit: z.number().int().nonnegative().optional(),
  cleaningFee: z.number().int().nonnegative().optional(),
  maintenanceFee: z.number().int().nonnegative().optional(),
  minStayMonths: z.number().int().min(1).optional(),
  availableFrom: z.string().optional(),
  capacity: z.number().int().min(1).max(20).nullable().optional(),
  bedrooms: z.number().int().min(1).max(10).nullable().optional(),
  images: z.array(z.string().url()).max(8).optional(),
});

@Controller("rooms")
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly legalRegions: LegalRegionService,
  ) {}

  @Get("regions")
  async regions(
    @Query("city") city = "서울특별시",
    @Query("district") district?: string,
  ) {
    return {
      items: await this.legalRegions.getNeighborhoods(city, district),
    };
  }

  @Get()
  search(@Query() q: any) {
    return this.rooms.search({
      region: q.region,
      district: q.district,
      legalDongCode: q.legalDongCode,
      verifiedByHost: q.verifiedByHost === "true" ? true : undefined,
      q: q.q,
      roomType: q.roomType,
      roomTypes: q.roomTypes
        ? String(q.roomTypes).split(",").filter(Boolean)
        : undefined,
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

  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  mine(@Req() req: any) {
    return this.rooms.listForHost(req.user.id);
  }

  @Get("personalized")
  @UseGuards(JwtAuthGuard)
  getPersonalized(@Req() req: any) {
    return this.rooms.getPersonalizedRooms(req.user.id);
  }

  @Get(":id/similar")
  findSimilar(@Param("id") id: string) {
    return this.rooms.findSimilar(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.rooms.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  create(
    @Req() req: any,
    @Body(new ZodValidationPipe(createRoomSchema)) dto: any,
  ) {
    return this.rooms.create(req.user.id, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRoomSchema)) dto: any,
  ) {
    return this.rooms.update(req.user.id, id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("HOST", "ADMIN")
  remove(@Req() req: any, @Param("id") id: string) {
    return this.rooms.remove(req.user.id, id);
  }
}
