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
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}

bootstrap();
