import { Module } from "@nestjs/common";
import { Resolver, Query, Args, ObjectType, Field, Int, ID } from "@nestjs/graphql";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.module";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { GeocodingService } from "./geocoding.service";

// ── GraphQL types (code-first) ──
@ObjectType()
class RoomType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() region!: string;
  @Field(() => Int) monthlyRent!: number;
  @Field(() => Int) deposit!: number;
  @Field() published!: boolean;
}

// GraphQL is offered alongside REST (optional per the stack). This resolver
// exposes read queries for rooms; mutations remain REST for the payment flow.
// Single-room reads are cached in Redis (60s TTL) to cut DB load.
@Resolver(() => RoomType)
export class RoomsResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  @Query(() => [RoomType], { name: "rooms" })
  async rooms(
    @Args("region", { nullable: true }) region?: string,
    @Args("take", { type: () => Int, nullable: true }) take = 20
  ) {
    return this.prisma.room.findMany({
      where: { published: true, ...(region ? { region } : {}) },
      take,
      orderBy: { createdAt: "desc" },
    });
  }

  @Query(() => RoomType, { name: "room", nullable: true })
  async room(@Args("id", { type: () => ID }) id: string) {
    const cacheKey = `room:${id}`;
    const cached = await this.redis.cacheGet<RoomType>(cacheKey);
    if (cached) return cached;

    const room = await this.prisma.room.findUnique({ where: { id } });
    if (room) await this.redis.cacheSet(cacheKey, room, 60);
    return room;
  }
}

@Module({
  controllers: [RoomsController],
  providers: [RoomsResolver, RoomsService, GeocodingService],
})
export class RoomsModule {}
