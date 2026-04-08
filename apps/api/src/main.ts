import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { AppModule } from "./app.module";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix("api/v1");

  const uploadsRoot = join(process.cwd(), "apps/api/uploads");
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, { prefix: "/uploads/" });

  app.enableCors({
    origin: [
      configService.get<string>("WEB_URL") ?? "http://localhost:3000",
    ],
    credentials: true,
  });

  const port = parseInt(configService.get<string>("PORT") ?? "3001", 10);
  // Omit host so Node binds the default (on macOS often dual-stack). Binding only `0.0.0.0`
  // can break iOS Simulator when `localhost` resolves to IPv6 (::1).
  const host = configService.get<string>("HOST");
  if (host != null && host.length > 0) {
    await app.listen(port, host);
    logger.log(`API running on http://localhost:${port}/api/v1 (bound on ${host})`);
  } else {
    await app.listen(port);
    logger.log(`API running on http://localhost:${port}/api/v1`);
  }
}

bootstrap();
