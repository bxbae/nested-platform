import { Global, Module, Injectable, OnModuleDestroy, Inject } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

// Thin Redis wrapper used for caching, the Socket.io adapter's pub/sub,
// rate-limiting, and BullMQ's connection.
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  async cacheGet<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
          maxRetriesPerRequest: null,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
