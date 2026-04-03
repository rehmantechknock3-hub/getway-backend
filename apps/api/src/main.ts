import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { AppModule } from "./app.module";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.setGlobalPrefix("api/v1");

  const uploadsRoot = join(process.cwd(), "apps/api/uploads");
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, { prefix: "/uploads/" });

  app.enableCors({
    origin: [
      process.env["WEB_URL"] ?? "http://localhost:3000",
    ],
    credentials: true,
  });

  const port = parseInt(process.env["PORT"] ?? "3001", 10);
  // Omit host so Node binds the default (on macOS often dual-stack). Binding only `0.0.0.0`
  // can break iOS Simulator when `localhost` resolves to IPv6 (::1).
  const host = process.env["HOST"];
  if (host != null && host.length > 0) {
    await app.listen(port, host);
    console.log(`API running on http://localhost:${port}/api/v1 (bound on ${host})`);
  } else {
    await app.listen(port);
    console.log(`API running on http://localhost:${port}/api/v1`);
  }
}

bootstrap();
