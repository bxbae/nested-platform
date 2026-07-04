import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, Injectable, Module } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/auth.guards";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { room: { include: { images: { take: 1 } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // idempotent add (unique on [userId, roomId])
  add(userId: string, roomId: string) {
    return this.prisma.favorite.upsert({
      where: { userId_roomId: { userId, roomId } },
      update: {},
      create: { userId, roomId },
    });
  }

  async remove(userId: string, roomId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, roomId } });
    return { ok: true };
  }
}

const addSchema = z.object({ roomId: z.string() });

// 찜 API
@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@Req() req: any) {
    return this.favorites.list(req.user.id);
  }

  @Post()
  add(@Req() req: any, @Body(new ZodValidationPipe(addSchema)) dto: any) {
    return this.favorites.add(req.user.id, dto.roomId);
  }

  @Delete(":roomId")
  remove(@Req() req: any, @Param("roomId") roomId: string) {
    return this.favorites.remove(req.user.id, roomId);
  }
}

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
