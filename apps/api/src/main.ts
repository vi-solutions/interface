import { config } from "dotenv";
import { join } from "path";
import "reflect-metadata";

config({ path: join(__dirname, "..", "..", "..", ".env") });

import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000" });
  app.useStaticAssets(join(__dirname, "..", "..", "uploads"), {
    prefix: "/uploads",
  });
  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
