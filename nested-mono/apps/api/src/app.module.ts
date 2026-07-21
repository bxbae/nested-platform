import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { BullModule } from "@nestjs/bullmq";
import { join } from "path";

import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./modules/auth/auth.controller";
import { ReservationsModule } from "./modules/reservations/reservations.module";
import { ChatModule } from "./modules/chat/chat.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RoomsModule } from "./modules/rooms/rooms.resolver";
import { StorageModule } from "./modules/storage/storage.controller";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { FavoritesModule } from "./modules/favorites/favorites.module";
import { CommunityModule } from "./modules/community/community.module";
import { NotificationsApiModule } from "./modules/notifications-api/notifications-api.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { AdminModule } from "./modules/admin/admin.module";
import { HostModule } from "./modules/host/host.module";
import { HostCalendarModule } from "./modules/host/host-calendar.module";
import { HostExportModule } from "./modules/host/host-export.module";
import { HostOverdueModule } from "./modules/host/host-overdue.module";
import { HostSettlementModule } from "./modules/host/host-settlement.module";
import { PreferenceModule } from "./modules/preference/preference.module";
import { MatchModule } from "./modules/match/match.module";
import { FriendsModule } from "./modules/friends/friends.module";
import { ReportsModule } from "./modules/reports/reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // BullMQ shares the Redis connection.
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
      },
    }),

    // GraphQL (optional) alongside REST — code-first, auto-generated schema.
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "src/schema.gql"),
      sortSchema: true,
      playground: true,
    }),

    PrismaModule,
    RedisModule,
    AuthModule,
    ReservationsModule,
    ChatModule,
    NotificationsModule,
    RoomsModule,
    StorageModule,
    ReviewsModule,
    FavoritesModule,
    CommunityModule,
    NotificationsApiModule,
    MessagesModule,
    AdminModule,
    HostModule,
    HostCalendarModule,
    HostExportModule,
    HostOverdueModule,
    HostSettlementModule,
    PreferenceModule,
    MatchModule,
    FriendsModule,
    ReportsModule,
  ],
})
export class AppModule {}
