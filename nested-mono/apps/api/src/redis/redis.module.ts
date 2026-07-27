import { Global, Module, Injectable, OnModuleDestroy, Inject, Logger } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

// Thin Redis wrapper used for caching, the Socket.io adapter's pub/sub,
// rate-limiting, and BullMQ's connection.
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}

  // Cache reads/writes are best-effort. If Redis is unreachable or over its
  // request quota (e.g. Upstash free-tier limit), callers should fall back
  // to the source of truth (DB) instead of the whole request failing with
  // a 500. A cache outage should degrade performance, not availability.
  async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      this.logger.warn(`cacheGet failed for "${key}": ${e}`);
      return null;
    }
  }

  async cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (e) {
      this.logger.warn(`cacheSet failed for "${key}": ${e}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch (e) {
      this.logger.warn(`redis quit failed: ${e}`);
    }
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
