import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { ServerOptions } from "socket.io";
import { AppModule } from "./app.module";

// Socket.io adapter backed by Redis pub/sub so chat scales across instances.
class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  async connect(url: string): Promise<void> {
    const pub = new Redis(url);
    const sub = pub.duplicate();
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allow the Next.js frontend origin(s). CORS_ORIGINS is a comma-separated
  // list (e.g. "http://localhost:3000,https://nested.app"); falls back to
  // reflecting the request origin in development.
  const origins = process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins && origins.length ? origins : true,
    credentials: true,
  });

  const redisAdapter = new RedisIoAdapter(app);
  await redisAdapter.connect(process.env.REDIS_URL ?? "redis://localhost:6379");
  app.useWebSocketAdapter(redisAdapter);

  // Bind to 0.0.0.0 (not localhost) so the platform's proxy — Railway, Render,
  // Docker, etc. — can route external traffic into the container.
  await app.listen(process.env.PORT ?? 4000, "0.0.0.0");
}
bootstrap();
