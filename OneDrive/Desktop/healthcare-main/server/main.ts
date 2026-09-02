import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "./app.module";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { buildCorsConfig } from "./_core/cors";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const rawAllowedOrigins = process.env.CORS_ORIGIN ?? [
    "https://healthcare-qu79.vercel.app",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
  ].join(",");

  app.enableCors(buildCorsConfig(rawAllowedOrigins));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT ?? "3000", 10);

  // Serve tRPC (used by the app's offline sync) on the same API server.
  // The broker reads the session from the "app_session_id" cookie (web) or a
  // Bearer token (native), so protected procedures work with cookie-based auth.
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  await app.listen(port);

  const hasRedis = !!(process.env.REDIS_URL && (() => {
    try {
      const url = new URL(process.env.REDIS_URL!);
      const port = parseInt(url.port || "6379", 10);
      const host = url.hostname || "localhost";
      require("child_process").execSync(
        `node -e "require('net').createConnection(${port},'${host}').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"`,
        { timeout: 2000, stdio: "pipe" },
      );
      return true;
    } catch { return false; }
  })());

  const hasDb = !!(process.env.DATABASE_URL && (() => {
    try {
      const url = new URL(process.env.DATABASE_URL!);
      const port = parseInt(url.port || "5432", 10);
      const host = url.hostname || "localhost";
      require("child_process").execSync(
        `node -e "require('net').createConnection(${port},'${host}').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"`,
        { timeout: 2000, stdio: "pipe" },
      );
      return true;
    } catch { return false; }
  })());

  const dbStatus = hasDb ? "PostgreSQL" : (process.env.DATABASE_URL ? "offline / in-memory (PostgreSQL unreachable)" : "none (no DATABASE_URL)");
  const redisStatus = hasRedis ? "Redis" : "in-memory cache";
  const queueStatus = hasRedis ? "Bull queues active" : "queues disabled (no Redis)";

  console.log("");
  console.log(`  [NestJS] Server listening on http://localhost:${port}`);
  console.log(`  Database:    ${dbStatus}`);
  console.log(`  Cache:       ${redisStatus}`);
  console.log(`  Queues:      ${queueStatus}`);
  console.log(`  Health:      http://localhost:${port}/api/health`);
  console.log("");
}

bootstrap();
