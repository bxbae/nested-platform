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
import { JwtService } from "@nestjs/jwt";
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
    // roomType은 기존 클라이언트 호환용. 신규 등록은 아래 3축을 사용한다.
    roomType: z.enum([
      "ONE_ROOM",
      "SHARE_ROOM",
      "WHOLE_HOUSE",
      "APARTMENT",
    ]).optional(),
    rentalUnit: z.enum(["WHOLE", "PRIVATE_ROOM", "BED"]).optional(),
    buildingType: z.enum(["STUDIO", "APARTMENT", "HOUSE"]).optional(),
    sharedFacilities: z.array(z.enum([
      "BATHROOM",
      "KITCHEN",
      "LIVING_ROOM",
      "LAUNDRY_ROOM",
      "ENTRANCE",
    ])).optional().default([]),
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
    const usesNewClassification = Boolean(data.rentalUnit || data.buildingType);

    if (usesNewClassification) {
      if (!data.rentalUnit) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rentalUnit"], message: "예약 공간을 선택해주세요." });
      }
      if (!data.buildingType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buildingType"], message: "건물 유형을 선택해주세요." });
      }
      if (data.capacity == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["capacity"], message: "최대 수용 인원을 입력해주세요." });
      }
      if (data.rentalUnit === "WHOLE" && data.sharedFacilities.length > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sharedFacilities"], message: "전체 숙소는 공유 시설을 선택하지 않습니다." });
      }
      if (data.rentalUnit && data.rentalUnit !== "WHOLE" && data.sharedFacilities.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sharedFacilities"], message: "공유 시설을 하나 이상 선택해주세요." });
      }
      return;
    }

    if (!data.roomType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["roomType"], message: "숙소 분류를 선택해주세요." });
      return;
    }
    if (data.roomType !== "WHOLE_HOUSE" && data.capacity == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["capacity"], message: "함께 지낼 인원수를 입력해주세요." });
    }
  });

const ROOM_TYPE_VALUES = ["ONE_ROOM", "SHARE_ROOM", "WHOLE_HOUSE", "APARTMENT"] as const;
const RENTAL_UNIT_VALUES = ["WHOLE", "PRIVATE_ROOM", "BED"] as const;
const BUILDING_TYPE_VALUES = ["STUDIO", "APARTMENT", "HOUSE"] as const;
const SHARED_FACILITY_VALUES = [
  "BATHROOM",
  "KITCHEN",
  "LIVING_ROOM",
  "LAUNDRY_ROOM",
  "ENTRANCE",
] as const;
const GENDER_POLICY_VALUES = ["ANY", "MALE_ONLY", "FEMALE_ONLY"] as const;
const SORT_VALUES = ["recommended", "price_asc", "price_desc", "rating", "newest"] as const;

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function enumCsv<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] | undefined {
  if (typeof value !== "string") return undefined;
  const allowedSet = new Set<string>(allowed);
  const values = [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is T => allowedSet.has(item)),
  )];
  return values.length ? values : undefined;
}

function finiteNumber(
  value: unknown,
  options: { positive?: boolean; integer?: boolean } = {},
) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (options.positive && parsed <= 0) return undefined;
  if (options.integer && !Number.isInteger(parsed)) return undefined;
  return parsed;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const updateRoomSchema = z.object({
  monthlyRent: z.number().int().positive().optional(),
  deposit: z.number().int().nonnegative().optional(),
  cleaningFee: z.number().int().nonnegative().optional(),
  maintenanceFee: z.number().int().nonnegative().optional(),
  minStayMonths: z.number().int().min(1).optional(),
  availableFrom: z.string().optional(),
  capacity: z.number().int().min(1).max(20).nullable().optional(),
  bedrooms: z.number().int().min(1).max(10).nullable().optional(),
  rentalUnit: z.enum(["WHOLE", "PRIVATE_ROOM", "BED"]).optional(),
  buildingType: z.enum(["STUDIO", "APARTMENT", "HOUSE"]).optional(),
  sharedFacilities: z.array(z.enum([
    "BATHROOM",
    "KITCHEN",
    "LIVING_ROOM",
    "LAUNDRY_ROOM",
    "ENTRANCE",
  ])).optional(),
  classificationReviewRequired: z.boolean().optional(),
  images: z.array(z.string().url()).max(8).optional(),
});

@Controller("rooms")
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly legalRegions: LegalRegionService,
    private readonly jwt: JwtService,
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
  async search(@Query() q: any, @Req() req: any) {
    // 검색은 비로그인도 가능한 공개 API지만, 로그인 상태면 토큰을 조용히
    // 검증해서 "내가 등록한 숙소" 뱃지 표시에 활용한다. 토큰이 없거나
    // 유효하지 않아도 에러 내지 않고 그냥 비로그인으로 취급한다.
    let currentUserId: string | undefined;
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const payload = await this.jwt.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
        });
        currentUserId = payload.sub;
      } catch {
        // 토큰 만료/위조 등 — 조용히 비로그인 취급
      }
    }

    return this.rooms.search({
      region: textValue(q.region),
      currentUserId,
      district: textValue(q.district),
      legalDongCode: textValue(q.legalDongCode),
      verifiedByHost: q.verifiedByHost === "true" ? true : undefined,
      q: textValue(q.q),
      roomType: enumValue(q.roomType, ROOM_TYPE_VALUES),
      roomTypes: enumCsv(q.roomTypes, ROOM_TYPE_VALUES),
      rentalUnits: enumCsv(q.rentalUnits, RENTAL_UNIT_VALUES),
      buildingTypes: enumCsv(q.buildingTypes, BUILDING_TYPE_VALUES),
      sharedFacilities: enumCsv(q.sharedFacilities, SHARED_FACILITY_VALUES),
      minRent: finiteNumber(q.minRent),
      maxRent: finiteNumber(q.maxRent),
      availableFrom: textValue(q.availableFrom),
      gender: enumValue(q.gender, GENDER_POLICY_VALUES),
      petsAllowed: q.petsAllowed === "true" ? true : undefined,
      smokingAllowed: q.smokingAllowed === "true" ? true : undefined,
      parking: q.parking === "true" ? true : undefined,
      sort: enumValue(q.sort, SORT_VALUES),
      cursor: textValue(q.cursor),
      minCapacity: finiteNumber(q.minCapacity, { positive: true, integer: true }),
      minBedrooms: finiteNumber(q.minBedrooms, { positive: true, integer: true }),
      checkIn: textValue(q.checkIn),
      checkOut: textValue(q.checkOut),
      take: finiteNumber(q.take, { positive: true, integer: true }),
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

  // GET /rooms/age-group — 같은 연령대에게 인기 있는 숙소
  @Get("age-group")
  @UseGuards(JwtAuthGuard)
  getAgeGroup(@Req() req: any) {
    return this.rooms.getAgeGroupRooms(req.user.id);
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
